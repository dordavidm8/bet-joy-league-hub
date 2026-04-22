const { pool } = require('../../config/database');
const { getGroqClient, getSocialConfig } = require('./socialMediaUtils');

/**
 * Summarizes the last 30 days of social analytics, PR mentions, and post performance
 * to update the "Unified Memory" block in the Knowledge Base.
 * Placed in the workflow to keep the agents aware of recent performance.
 */
async function buildUnifiedMemory() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  // 1. Fetch top posts
  const topPosts = await pool.query(
    `SELECT p.platform, p.caption, a.likes, a.comments, a.impressions 
     FROM social_posts p
     JOIN social_post_analytics a ON a.post_id = p.id
     WHERE p.created_at >= $1 AND a.likes > 0
     ORDER BY a.likes DESC LIMIT 10`,
    [thirtyDaysAgo]
  );

  // 2. Fetch recent PR risks
  const risks = await pool.query(
    `SELECT source, content, sentiment FROM social_mentions 
     WHERE analyzed_at >= $1 AND is_pr_risk = true LIMIT 5`,
    [thirtyDaysAgo]
  );

  // Build the prompt payload
  const payload = `
Recent Top Posts (Last 30 Days):
${topPosts.rows.map(p => `[${p.platform}] <${p.likes} Likes>: ${p.caption.slice(0, 100)}...`).join('\n')}

Recent PR Risks detected:
${risks.rows.length === 0 ? 'None. Good job!' : risks.rows.map(r => `[${r.source} - ${r.sentiment}] ${r.content}`).join('\n')}
`;

  const config = await getSocialConfig();
  const groq = getGroqClient();
  const model = config.model || 'llama-3.3-70b-versatile';

  const system = `אתה האנליסט הפנימי של KickOff. תפקידך לקחת נתוני ביצועים גולמיים מהחודש האחרון ולנסח מסמך תובנות ("Unified Memory") של 2 פסקאות בעברית, כדי שהקופירייטר (האייגנט) יידע מה עבד טוב מול הקהל ולשמור על מודעות למצבי סיכון שקרו לאחרונה. סיכום מקצועי ומניע לפעולה.`;

  try {
    const response = await groq.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: payload }
      ],
      temperature: 0.5,
    });

    const summary = response.choices[0].message.content;

    // Upsert into Knowledge Base as category 'brand', title 'Unified Memory - Last 30 Days'
    const existing = await pool.query(`SELECT id FROM social_knowledge_base WHERE title = 'Unified Memory - Last 30 Days' LIMIT 1`);
    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE social_knowledge_base SET content = $1, updated_at = NOW() WHERE id = $2`,
        [summary, existing.rows[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO social_knowledge_base (title, content, category) VALUES ($1, $2, $3)`,
        ['Unified Memory - Last 30 Days', summary, 'brand']
      );
    }
    console.log('[UnifiedMemory] Successfully updated 30-day analytics memory.');
  } catch (err) {
    console.error('[UnifiedMemory] Error building unified memory:', err.message);
  }
}

module.exports = {
  buildUnifiedMemory
};
