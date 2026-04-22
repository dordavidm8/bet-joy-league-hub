'use strict';

const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { logAdminAction } = require('../services/adminLogService');
const {
  getSocialConfig, updateSocialConfig, updatePost, loadKnowledgeBase,
} = require('../services/social/socialMediaUtils');
const { runDailySocialMediaPipeline } = require('../services/social/orchestratorAgent');
const { publish } = require('../services/social/publisherAgent');

// All routes require admin auth
router.use(authenticate, requireAdmin);

// ═══════════════════════════════════════════════════════════════
// PIPELINE RUNS
// ═══════════════════════════════════════════════════════════════

// GET /api/social/runs — list pipeline runs
router.get('/runs', async (req, res, next) => {
  const limit = Math.min(parseInt(req.query.limit) || 30, 100);
  try {
    const result = await pool.query(
      `SELECT * FROM social_pipeline_runs ORDER BY started_at DESC LIMIT $1`,
      [limit]
    );
    res.json({ runs: result.rows });
  } catch (err) { next(err); }
});

// POST /api/social/runs/trigger — manually trigger pipeline
router.post('/runs/trigger', async (req, res, next) => {
  const { dryRun } = req.body;
  try {
    await logAdminAction(req.user.email, 'trigger_social_pipeline', 'social', null, { dryRun: !!dryRun });
    // Run async — respond immediately
    res.json({ message: 'Pipeline triggered', dryRun: !!dryRun });
    runDailySocialMediaPipeline({
      triggeredBy: 'manual',
      dryRun: !!dryRun,
      triggeredEmail: req.user.email,
    }).catch(err => console.error('[socialRoutes] Pipeline error:', err.message));
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════
// POSTS
// ═══════════════════════════════════════════════════════════════

// GET /api/social/posts — list posts
router.get('/posts', async (req, res, next) => {
  const { status, platform, limit: rawLimit } = req.query;
  const limit = Math.min(parseInt(rawLimit) || 50, 200);
  try {
    let query = `SELECT id, pipeline_run_id, platform, caption, final_caption, hashtags,
                        media_type, image_url, video_url, status, published_at,
                        approved_by, rejection_reason, created_at, updated_at
                 FROM social_posts WHERE 1=1`;
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    if (platform) {
      params.push(platform);
      query += ` AND platform = $${params.length}`;
    }

    params.push(limit);
    query += ` ORDER BY created_at DESC LIMIT $${params.length}`;

    const result = await pool.query(query, params);
    res.json({ posts: result.rows });
  } catch (err) { next(err); }
});

// GET /api/social/posts/:id — single post with full data
router.get('/posts/:id', async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT * FROM social_posts WHERE id = $1`, [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Post not found' });

    // Include analytics if available
    const analytics = await pool.query(
      `SELECT * FROM social_post_analytics WHERE post_id = $1 ORDER BY fetched_at DESC LIMIT 10`,
      [req.params.id]
    );

    res.json({ post: result.rows[0], analytics: analytics.rows });
  } catch (err) { next(err); }
});

// POST /api/social/posts/:id/approve — approve a post
router.post('/posts/:id/approve', async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE social_posts SET status = 'approved', approved_by = $1, updated_at = NOW()
       WHERE id = $2 AND status = 'pending_approval' RETURNING id, platform`,
      [req.user.email, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Post not found or not pending' });
    await logAdminAction(req.user.email, 'approve_social_post', 'social_post', req.params.id, { platform: result.rows[0].platform });

    // Check if all posts in this run are approved → auto-publish
    const post = await pool.query(`SELECT * FROM social_posts WHERE id = $1`, [req.params.id]);
    if (post.rows[0]?.pipeline_run_id) {
      const pending = await pool.query(
        `SELECT COUNT(*) FROM social_posts WHERE pipeline_run_id = $1 AND status = 'pending_approval'`,
        [post.rows[0].pipeline_run_id]
      );
      if (parseInt(pending.rows[0].count) === 0) {
        // All posts approved — publish
        const approved = await pool.query(
          `SELECT * FROM social_posts WHERE pipeline_run_id = $1 AND status = 'approved'`,
          [post.rows[0].pipeline_run_id]
        );
        // Build context for publisher
        const ctx = { publishResults: {} };
        for (const p of approved.rows) {
          ctx[p.platform] = { finalCaption: p.final_caption || p.caption, imageUrl: p.image_url, videoUrl: p.video_url };
          ctx[`${p.platform}PostDbId`] = p.id;
        }
        publish(ctx).catch(err => console.error('[socialRoutes] Auto-publish error:', err.message));
      }
    }

    res.json({ message: 'Post approved' });
  } catch (err) { next(err); }
});

// POST /api/social/posts/:id/reject — reject a post
router.post('/posts/:id/reject', async (req, res, next) => {
  const { reason } = req.body;
  try {
    const result = await pool.query(
      `UPDATE social_posts SET status = 'rejected', rejection_reason = $1, approved_by = $2, updated_at = NOW()
       WHERE id = $3 AND status = 'pending_approval' RETURNING id, platform`,
      [reason || null, req.user.email, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Post not found or not pending' });
    await logAdminAction(req.user.email, 'reject_social_post', 'social_post', req.params.id, { reason });
    res.json({ message: 'Post rejected' });
  } catch (err) { next(err); }
});

// PUT /api/social/posts/:id — edit a post (caption, hashtags)
router.put('/posts/:id', async (req, res, next) => {
  const { caption, final_caption, hashtags } = req.body;
  try {
    const sets = ['updated_at = NOW()'];
    const params = [];

    if (caption !== undefined) {
      params.push(caption);
      sets.push(`caption = $${params.length}`);
    }
    if (final_caption !== undefined) {
      params.push(final_caption);
      sets.push(`final_caption = $${params.length}`);
    }
    if (hashtags !== undefined) {
      params.push(hashtags);
      sets.push(`hashtags = $${params.length}`);
    }

    params.push(req.params.id);
    const result = await pool.query(
      `UPDATE social_posts SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING id`,
      params
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Post not found' });
    await logAdminAction(req.user.email, 'edit_social_post', 'social_post', req.params.id, { caption, hashtags });
    res.json({ message: 'Post updated' });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════════

// GET /api/social/analytics/overview — aggregate analytics
router.get('/analytics/overview', async (req, res, next) => {
  const days = parseInt(req.query.days) || 30;
  try {
    const [totals, byPlatform, recentPosts] = await Promise.all([
      pool.query(`
        SELECT COUNT(*) AS total_posts,
               COUNT(*) FILTER (WHERE status = 'published') AS published,
               COUNT(*) FILTER (WHERE status = 'pending_approval') AS pending,
               COUNT(*) FILTER (WHERE status = 'rejected') AS rejected
        FROM social_posts WHERE created_at > NOW() - INTERVAL '${days} days'
      `),
      pool.query(`
        SELECT p.platform,
               COUNT(*) AS total,
               COALESCE(SUM(a.impressions), 0) AS impressions,
               COALESCE(SUM(a.likes), 0) AS likes,
               COALESCE(SUM(a.comments), 0) AS comments,
               COALESCE(SUM(a.shares), 0) AS shares
        FROM social_posts p
        LEFT JOIN social_post_analytics a ON a.post_id = p.id
        WHERE p.created_at > NOW() - INTERVAL '${days} days'
        GROUP BY p.platform
      `),
      pool.query(`
        SELECT p.id, p.platform, p.status, p.published_at, p.caption,
               a.impressions, a.likes, a.comments, a.shares
        FROM social_posts p
        LEFT JOIN LATERAL (
          SELECT * FROM social_post_analytics WHERE post_id = p.id ORDER BY fetched_at DESC LIMIT 1
        ) a ON true
        WHERE p.created_at > NOW() - INTERVAL '${days} days'
        ORDER BY p.created_at DESC LIMIT 10
      `),
    ]);

    res.json({
      totals: totals.rows[0],
      byPlatform: byPlatform.rows,
      recentPosts: recentPosts.rows,
    });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════
// KNOWLEDGE BASE
// ═══════════════════════════════════════════════════════════════

// GET /api/social/knowledge-base
router.get('/knowledge-base', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT * FROM social_knowledge_base ORDER BY category, title`
    );
    res.json({ entries: result.rows });
  } catch (err) { next(err); }
});

// POST /api/social/knowledge-base
router.post('/knowledge-base', async (req, res, next) => {
  const { title, content, category } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'title and content required' });
  try {
    const result = await pool.query(
      `INSERT INTO social_knowledge_base (title, content, category) VALUES ($1,$2,$3) RETURNING *`,
      [title, content, category || 'general']
    );
    await logAdminAction(req.user.email, 'add_knowledge_base', 'social_knowledge_base', result.rows[0].id, { title });
    res.status(201).json({ entry: result.rows[0] });
  } catch (err) { next(err); }
});

// PUT /api/social/knowledge-base/:id
router.put('/knowledge-base/:id', async (req, res, next) => {
  const { title, content, category, is_active } = req.body;
  try {
    const result = await pool.query(
      `UPDATE social_knowledge_base
       SET title = COALESCE($1, title), content = COALESCE($2, content),
           category = COALESCE($3, category), is_active = COALESCE($4, is_active),
           updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [title, content, category, is_active, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json({ entry: result.rows[0] });
  } catch (err) { next(err); }
});

// DELETE /api/social/knowledge-base/:id
router.delete('/knowledge-base/:id', async (req, res, next) => {
  try {
    await pool.query(`DELETE FROM social_knowledge_base WHERE id = $1`, [req.params.id]);
    await logAdminAction(req.user.email, 'delete_knowledge_base', 'social_knowledge_base', req.params.id, null);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════
// COMPETITOR POSTS & SOCIAL LISTENING
// ═══════════════════════════════════════════════════════════════

// GET /api/social/competitor/posts
router.get('/competitor/posts', async (req, res, next) => {
  const limit = Math.min(parseInt(req.query.limit) || 30, 100);
  try {
    const result = await pool.query(
      `SELECT * FROM social_competitor_posts ORDER BY fetched_at DESC LIMIT $1`,
      [limit]
    );
    res.json({ posts: result.rows });
  } catch (err) { next(err); }
});

// GET /api/social/mentions
router.get('/mentions', async (req, res, next) => {
  const limit = Math.min(parseInt(req.query.limit) || 30, 100);
  try {
    const result = await pool.query(
      `SELECT * FROM social_mentions ORDER BY analyzed_at DESC LIMIT $1`,
      [limit]
    );
    res.json({ mentions: result.rows });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════

// GET /api/social/config
router.get('/config', async (req, res, next) => {
  try {
    const config = await getSocialConfig();
    res.json({ config });
  } catch (err) { next(err); }
});

// PATCH /api/social/config
router.patch('/config', async (req, res, next) => {
  const allowedKeys = [
    'enabled', 'auto_approve', 'posting_time', 'timezone',
    'linkedin_enabled', 'instagram_enabled', 'tiktok_enabled',
    'brand_voice', 'content_style', 'daily_limit', 'model',
  ];
  const updates = Object.entries(req.body).filter(([k]) => allowedKeys.includes(k));
  if (updates.length === 0) return res.status(400).json({ error: 'No valid config keys' });
  try {
    for (const [key, value] of updates) {
      await updateSocialConfig(key, value, req.user.email);
    }
    await logAdminAction(req.user.email, 'update_social_config', 'social_config', null, req.body);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════
// MANAGEMENT CHAT
// ═══════════════════════════════════════════════════════════════

// GET /api/social/chat — get chat history
router.get('/chat', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT * FROM social_chat_history WHERE user_email = $1 ORDER BY created_at ASC LIMIT 100`,
      [req.user.email]
    );
    res.json({ messages: result.rows });
  } catch (err) { next(err); }
});

// POST /api/social/chat — send a message
router.post('/chat', async (req, res, next) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });
  try {
    // Save user message
    await pool.query(
      `INSERT INTO social_chat_history (user_email, role, content) VALUES ($1, 'user', $2)`,
      [req.user.email, message]
    );

    // Get recent history for context
    const historyRes = await pool.query(
      `SELECT role, content FROM social_chat_history WHERE user_email = $1 ORDER BY created_at DESC LIMIT 20`,
      [req.user.email]
    );
    const history = historyRes.rows.reverse();

    // Generate response via Groq Tool Calling
    const { processManagementChat } = require('../services/social/managementChatAgent');
    const reply = await processManagementChat(req.user.email, history, message);

    // Save assistant message
    await pool.query(
      `INSERT INTO social_chat_history (user_email, role, content) VALUES ($1, 'assistant', $2)`,
      [req.user.email, reply]
    );

    res.json({ reply, role: 'assistant' });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════
// MAGIC SWITCH
// ═══════════════════════════════════════════════════════════════

// POST /api/social/magic-switch — convert text to all formats
router.post('/magic-switch', async (req, res, next) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });
  try {
    const { callClaude, parseJsonResponse } = require('../services/social/socialMediaUtils');

    const systemPrompt = `אתה קופירייטר מומחה של KickOff. המר את הטקסט הבא לכל הפורמטים הבאים.
כתוב בעברית, hashtags באנגלית.`;

    const userPrompt = `טקסט מקור:
${text}

המר ל-5 פורמטים. החזר JSON:
{
  "linkedin": "פוסט LinkedIn (מקצועי, 150-300 מילים)",
  "instagram": "פוסט Instagram (ויזואלי, קצר, עם hashtags)",
  "tiktok": "סקריפט TikTok (15-30 שניות, hook חזק)",
  "linkedin_carousel": "5 שקפים לקרוסלה (מערך של 5 מחרוזות)",
  "tweet": "ציוץ (280 תווים מקס)"
}`;

    const response = await callClaude(systemPrompt, userPrompt, { temperature: 0.7 });
    const parsed = parseJsonResponse(response);

    if (!parsed) return res.status(500).json({ error: 'Failed to convert content' });

    res.json({ formats: parsed });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════
// STATUS
// ═══════════════════════════════════════════════════════════════

// GET /api/social/status — overall system status
router.get('/status', async (req, res, next) => {
  try {
    const [config, lastRun, pendingPosts, prRisks] = await Promise.all([
      getSocialConfig(),
      pool.query(`SELECT * FROM social_pipeline_runs ORDER BY started_at DESC LIMIT 1`),
      pool.query(`SELECT COUNT(*) FROM social_posts WHERE status = 'pending_approval'`),
      pool.query(`SELECT COUNT(*) FROM social_mentions WHERE is_pr_risk = true AND analyzed_at > NOW() - INTERVAL '24 hours'`),
    ]);

    res.json({
      enabled: config.enabled === 'true',
      autoApprove: config.auto_approve === 'true',
      postingTime: config.posting_time,
      lastRun: lastRun.rows[0] || null,
      pendingPosts: parseInt(pendingPosts.rows[0].count),
      prRisks24h: parseInt(prRisks.rows[0].count),
    });
  } catch (err) { next(err); }
});

module.exports = router;
