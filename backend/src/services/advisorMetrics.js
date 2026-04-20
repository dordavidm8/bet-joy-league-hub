const { pool } = require('../config/database');

async function logEvent(event) {
  try {
    await pool.query(
      `INSERT INTO advisor_events
         (user_id, thread_id, game_id, event_type, tool_name, tool_args, tool_cached,
          duration_ms, prompt_tokens, completion_tokens, total_tokens, model, error_message)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        event.user_id    ?? null,
        event.thread_id  ?? null,
        event.game_id    ?? null,
        event.event_type,
        event.tool_name  ?? null,
        event.tool_args  ? JSON.stringify(event.tool_args) : null,
        event.tool_cached ?? null,
        event.duration_ms ?? null,
        event.prompt_tokens     ?? null,
        event.completion_tokens ?? null,
        event.total_tokens      ?? null,
        event.model      ?? null,
        event.error_message ?? null,
      ]
    );
  } catch (err) {
    console.warn('[advisorMetrics] logEvent failed:', err.message);
  }
}

async function getStats(days = 30) {
  const res = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE event_type = 'llm_call') AS total_requests,
       COALESCE(SUM(total_tokens) FILTER (WHERE event_type = 'llm_call'), 0) AS total_tokens,
       COALESCE(SUM(total_tokens) FILTER (WHERE event_type = 'llm_call'), 0) * 0.00000059 AS cost_usd,
       COUNT(*) FILTER (WHERE event_type = 'error') AS error_count,
       ROUND(AVG(duration_ms) FILTER (WHERE event_type = 'llm_call'))::int AS avg_latency_ms,
       PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms)
         FILTER (WHERE event_type = 'llm_call') AS p50_ms,
       PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)
         FILTER (WHERE event_type = 'llm_call') AS p95_ms
     FROM advisor_events
     WHERE created_at >= NOW() - INTERVAL '${days} days'`
  );
  return res.rows[0];
}

async function getDaily(days = 30) {
  const res = await pool.query(
    `SELECT
       DATE(created_at) AS date,
       COUNT(*) FILTER (WHERE event_type = 'llm_call') AS requests,
       COALESCE(SUM(total_tokens) FILTER (WHERE event_type = 'llm_call'), 0) AS tokens
     FROM advisor_events
     WHERE created_at >= NOW() - INTERVAL '${days} days'
     GROUP BY DATE(created_at)
     ORDER BY date ASC`
  );
  return res.rows;
}

async function getToolBreakdown(days = 30) {
  const res = await pool.query(
    `SELECT tool_name, COUNT(*) AS calls,
            ROUND(AVG(duration_ms))::int AS avg_ms
     FROM advisor_events
     WHERE event_type = 'tool_call' AND tool_name IS NOT NULL
       AND created_at >= NOW() - INTERVAL '${days} days'
     GROUP BY tool_name
     ORDER BY calls DESC`
  );
  return res.rows;
}

async function getTopUsers(days = 30, limit = 20) {
  const res = await pool.query(
    `SELECT user_id,
            COUNT(*) FILTER (WHERE event_type = 'llm_call') AS requests,
            COALESCE(SUM(total_tokens) FILTER (WHERE event_type = 'llm_call'), 0) AS tokens
     FROM advisor_events
     WHERE created_at >= NOW() - INTERVAL '${days} days'
       AND user_id IS NOT NULL
     GROUP BY user_id
     ORDER BY requests DESC
     LIMIT $1`,
    [limit]
  );
  return res.rows;
}

async function getEvents(limit = 50, offset = 0) {
  const res = await pool.query(
    `SELECT id, user_id, event_type, tool_name, total_tokens, duration_ms, error_message, created_at
     FROM advisor_events
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return res.rows;
}

module.exports = { logEvent, getStats, getDaily, getToolBreakdown, getTopUsers, getEvents };
