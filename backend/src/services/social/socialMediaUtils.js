'use strict';

const { pool } = require('../../config/database');
const { getSecret } = require('../../lib/secrets');

// ── Groq Client ─────────────────────────────────────────────────────────────
let _groqClient = null;

async function getGroqClient() {
  if (_groqClient) return _groqClient;
  const Groq = require('groq-sdk');
  const apiKey = await getSecret('GROQ_API_KEY');
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');
  _groqClient = new Groq({ apiKey });
  return _groqClient;
}

// ── Gemini Client ───────────────────────────────────────────────────────────
let _geminiClient = null;

async function getGeminiClient() {
  if (_geminiClient) return _geminiClient;
  const { GoogleGenAI } = require('@google/genai');
  const apiKey = await getSecret('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
  _geminiClient = new GoogleGenAI({ apiKey });
  return _geminiClient;
}

// ── Social Config ───────────────────────────────────────────────────────────

async function getSocialConfig() {
  const result = await pool.query('SELECT key, value FROM social_agent_config');
  return Object.fromEntries(result.rows.map(r => [r.key, r.value]));
}

async function updateSocialConfig(key, value, updatedBy) {
  await pool.query(
    `INSERT INTO social_agent_config (key, value, updated_at, updated_by)
     VALUES ($1, $2, NOW(), $3)
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW(), updated_by = $3`,
    [key, String(value), updatedBy]
  );
}

// ── Games helpers ───────────────────────────────────────────────────────────

async function getTodaysGames() {
  const result = await pool.query(`
    SELECT g.*, c.name AS competition_name, c.slug AS competition_slug
    FROM games g
    LEFT JOIN competitions c ON c.id = g.competition_id
    WHERE g.start_time::date = CURRENT_DATE
    ORDER BY g.start_time ASC
  `);
  return result.rows;
}

async function getUpcomingGames(days = 3) {
  const result = await pool.query(`
    SELECT g.*, c.name AS competition_name, c.slug AS competition_slug
    FROM games g
    LEFT JOIN competitions c ON c.id = g.competition_id
    WHERE g.start_time BETWEEN NOW() AND NOW() + INTERVAL '${days} days'
      AND g.status = 'scheduled'
    ORDER BY g.start_time ASC
    LIMIT 20
  `);
  return result.rows;
}

// ── Post CRUD ───────────────────────────────────────────────────────────────

async function savePost(postData) {
  const {
    pipeline_run_id, platform, caption, final_caption, hashtags,
    media_type, image_prompt, image_url, image_base64,
    video_prompt, video_url, geo_content,
    hook_he, hook_en, overlay_lines, cta, script, status
  } = postData;

  const result = await pool.query(
    `INSERT INTO social_posts
       (pipeline_run_id, platform, caption, final_caption, hashtags,
        media_type, image_prompt, image_url, image_base64,
        video_prompt, video_url, geo_content,
        hook_he, hook_en, overlay_lines, cta, script, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     RETURNING id`,
    [
      pipeline_run_id, platform, caption, final_caption, hashtags || [],
      media_type || 'image', image_prompt, image_url, image_base64,
      video_prompt, video_url, geo_content ? JSON.stringify(geo_content) : null,
      hook_he, hook_en, overlay_lines || [], cta, script, status || 'draft'
    ]
  );
  return result.rows[0].id;
}

async function updatePost(postId, updates) {
  const allowed = [
    'caption', 'final_caption', 'hashtags', 'image_url', 'image_base64',
    'video_url', 'status', 'published_at', 'published_id',
    'rejection_reason', 'approved_by', 'geo_content'
  ];
  const entries = Object.entries(updates).filter(([k]) => allowed.includes(k));
  if (entries.length === 0) return;

  const sets = entries.map(([k], i) => {
    if (k === 'geo_content') return `${k} = $${i + 1}::jsonb`;
    return `${k} = $${i + 1}`;
  });
  const values = entries.map(([k, v]) => {
    if (k === 'geo_content' && typeof v === 'object') return JSON.stringify(v);
    return v;
  });
  sets.push(`updated_at = NOW()`);

  await pool.query(
    `UPDATE social_posts SET ${sets.join(', ')} WHERE id = $${values.length + 1}`,
    [...values, postId]
  );
}

// ── Pipeline runs ───────────────────────────────────────────────────────────

async function savePipelineRun(runData) {
  const {
    id, run_date, status, triggered_by, triggered_email, dry_run,
    weekly_theme, content_angle, agent_log, errors
  } = runData;

  // Upsert
  await pool.query(
    `INSERT INTO social_pipeline_runs
       (id, run_date, status, triggered_by, triggered_email, dry_run,
        weekly_theme, content_angle, agent_log, errors, started_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, NOW())
     ON CONFLICT (id) DO UPDATE SET
       status = EXCLUDED.status,
       weekly_theme = COALESCE(EXCLUDED.weekly_theme, social_pipeline_runs.weekly_theme),
       content_angle = COALESCE(EXCLUDED.content_angle, social_pipeline_runs.content_angle),
       agent_log = COALESCE(EXCLUDED.agent_log, social_pipeline_runs.agent_log),
       errors = COALESCE(EXCLUDED.errors, social_pipeline_runs.errors),
       finished_at = CASE WHEN EXCLUDED.status IN ('completed','failed') THEN NOW() ELSE social_pipeline_runs.finished_at END`,
    [
      id, run_date, status, triggered_by || 'manual', triggered_email || null,
      dry_run || false,
      weekly_theme ? JSON.stringify(weekly_theme) : null,
      content_angle ? JSON.stringify(content_angle) : null,
      agent_log ? JSON.stringify(agent_log) : null,
      errors ? JSON.stringify(errors) : null
    ]
  );
}

// ── Knowledge base ──────────────────────────────────────────────────────────

async function loadKnowledgeBase() {
  const result = await pool.query(
    `SELECT title, content, category FROM social_knowledge_base WHERE is_active = true ORDER BY category, title`
  );
  return result.rows;
}

// ── Unified memory ──────────────────────────────────────────────────────────

async function loadTopMemories(limit = 20) {
  const result = await pool.query(
    `SELECT memory_type, content, importance, source, created_at
     FROM social_unified_memory
     WHERE (expires_at IS NULL OR expires_at >= CURRENT_DATE)
     ORDER BY importance DESC, created_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

// ── Groq helper ─────────────────────────────────────────────────────────────

async function callClaude(systemPrompt, userPrompt, options = {}) {
  const client = await getGroqClient();
  const config = await getSocialConfig();
  const model = options.model || config.model || 'llama-3.3-70b-versatile';

  const response = await client.chat.completions.create({
    model,
    max_tokens: options.maxTokens || 4096,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
  });

  return response.choices[0]?.message?.content || '';
}

// ── JSON parser ─────────────────────────────────────────────────────────────

function parseJsonResponse(text) {
  // Try to extract JSON from markdown code fences or raw JSON
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  const jsonStr = fenceMatch ? fenceMatch[1].trim() : text.trim();
  try {
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error('[socialUtils] JSON parse error:', err.message, '\nRaw:', jsonStr.slice(0, 200));
    return null;
  }
}

// ── Prompt formatters ───────────────────────────────────────────────────────

function formatGamesForPrompt(games) {
  if (!games || games.length === 0) return 'אין משחקים היום.';
  return games.map(g => {
    const time = new Date(g.start_time).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' });
    const status = g.status === 'finished' ? `(נגמר ${g.score_home}-${g.score_away})` : `(${time})`;
    return `• ${g.home_team} vs ${g.away_team} ${status} — ${g.competition_name || ''}`;
  }).join('\n');
}

function formatKnowledgeBaseForPrompt(kbEntries) {
  if (!kbEntries || kbEntries.length === 0) return '';
  return kbEntries.map(e => `[${e.category}] ${e.title}: ${e.content}`).join('\n');
}

function formatMemoriesForPrompt(memories) {
  if (!memories || memories.length === 0) return '';
  return memories.map(m => `[${m.memory_type}, importance: ${m.importance}] ${m.content}`).join('\n');
}

module.exports = {
  getGroqClient,
  getGeminiClient,
  getSocialConfig,
  updateSocialConfig,
  getTodaysGames,
  getUpcomingGames,
  savePost,
  updatePost,
  savePipelineRun,
  loadKnowledgeBase,
  loadTopMemories,
  callClaude,
  parseJsonResponse,
  formatGamesForPrompt,
  formatKnowledgeBaseForPrompt,
  formatMemoriesForPrompt,
};
