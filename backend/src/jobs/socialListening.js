/**
 * socialListening.js – ניטור אזכורים ברשת
 *
 * מחפש אזכורי המותג ברשתות חברתיות.
 * שומר ב-social_mentions table עם sentiment ו-PR risk flag.
 */
'use strict';

const { pool } = require('../config/database');

/**
 * Social Listening Job
 * Uses Serper API to find mentions of DerbyUp and analyze sentiment.
 */
async function runSocialListening() {
  const { getSecret } = require('../lib/secrets');
  const { callGroqPipeline } = require('../agents/tools/groqClient');

  const apiKey = await getSecret('SERPER_API_KEY');
  if (!apiKey) {
    console.log('[socialListening] No SERPER_API_KEY configured — skipping');
    return;
  }

  try {
    const queries = ['DerbyUp app Israel', 'דרביאפ אפליקציה', 'DerbyUp football betting'];

    for (const query of queries) {
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: query, gl: 'il', hl: 'he', num: 10 }),
      });

      if (!res.ok) continue;
      const data = await res.json();
      const results = [...(data.organic || []), ...(data.news || [])].slice(0, 5);

      for (const result of results) {
        // Check if already stored
        const existing = await pool.query(
          `SELECT 1 FROM social_mentions WHERE url = $1`,
          [result.link]
        );
        if (existing.rows.length > 0) continue;

        // Analyze sentiment with Groq
        const groqRes = await callGroqPipeline(
          'You are a sentiment analysis agent. Classify the sentiment and PR risk of mentions about DerbyUp app Israel.',
          `Analyze this mention:\nTitle: ${result.title}\nSnippet: ${result.snippet}\nURL: ${result.link}\n\nReturn JSON: {"sentiment": "positive|neutral|negative", "is_pr_risk": true|false}`,
          { jsonMode: true, max_tokens: 200, temperature: 0 }
        );

        let sentiment = { sentiment: 'neutral', is_pr_risk: false };
        if (groqRes.success && groqRes.text) {
          try {
            sentiment = typeof groqRes.text === 'string' ? JSON.parse(groqRes.text) : groqRes.text;
          } catch(e) {
            console.warn('[socialListening] Failed parsing Groq JSON:', e.message);
          }
        }

        await pool.query(
          `INSERT INTO social_mentions (source, platform, url, snippet, sentiment, is_pr_risk)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [result.title, 'web', result.link, result.snippet, sentiment.sentiment, sentiment.is_pr_risk]
        );

        // Emit socket event if PR risk
        if (sentiment.is_pr_risk) {
          try {
            const { app } = require('../app');
            const io = app.get('io');
            if (io) io.emit('social:pr_risk', { url: result.link, snippet: result.snippet });
          } catch (_) {}
        }
      }
    }

    console.log('[socialListening] Completed');
  } catch (err) {
    console.error('[socialListening] Error:', err.message);
  }
}

module.exports = { runSocialListening };
