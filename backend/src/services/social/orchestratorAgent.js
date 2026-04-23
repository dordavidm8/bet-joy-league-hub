/**
 * orchestratorAgent.js – מתאם pipeline מדיה חברתית
 *
 * runDailySocialMediaPipeline() –
 *   מריץ את כל הסוכנים ברצף ליצירת פוסטים יומיים:
 *   1. בדיקת idempotency (לא לרוץ פעמיים באותו יום)
 *   2. טעינת context: משחקים היום, בסיס ידע, זיכרונות
 *   3. contentCalendarAgent → נושא שבועי
 *   4. growthStrategyAgent  → זווית צמיחה
 *   5. contentCreatorAgent  → כתיבת כיתוב
 *   6. visualCreatorAgent   → תיאור תמונה/וידאו
 *   7. seoGeoAgent          → hashtags ואופטימיזציה
 *   8. publisherAgent       → פרסום לפלטפורמות
 *   9. שמירת הפוסט ולוג הריצה ב-DB
 */
'use strict';

const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const {
  getSocialConfig, savePipelineRun, savePost, loadKnowledgeBase, loadTopMemories,
  getTodaysGames,
} = require('./socialMediaUtils');
const { getWeeklyTheme } = require('./contentCalendarAgent');
const { analyzeAndRecommend } = require('./growthStrategyAgent');
const { generateContent } = require('./contentCreatorAgent');
const { generateVisuals } = require('./visualCreatorAgent');
const { optimize } = require('./seoGeoAgent');
const { publish } = require('./publisherAgent');

/**
 * Orchestrator Agent
 * Runs the full daily social media pipeline:
 *   1. Idempotency check
 *   2. Build context
 *   3. Content Calendar → Growth Strategy → Content Creator → Visual Creator → SEO/GEO
 *   4. Save posts as pending_approval
 *   5. Auto-publish if configured
 */
async function runDailySocialMediaPipeline({ triggeredBy = 'manual', dryRun = false, triggeredEmail = null } = {}) {
  const runDate = new Date().toISOString().split('T')[0];
  const runId = uuidv4();

  console.log(`[social:orchestrator] Starting pipeline for ${runDate} (run: ${runId}, by: ${triggeredBy})`);

  // ── 1. Check config ──────────────────────────────────────────────────────
  const config = await getSocialConfig();

  if (config.enabled !== 'true') {
    console.log('[social:orchestrator] Social agents disabled — skipping');
    return { skipped: true, reason: 'disabled' };
  }

  // ── 2. Idempotency — skip if already completed today ─────────────────────
  const existingRun = await pool.query(
    `SELECT id, status FROM social_pipeline_runs WHERE run_date = $1 AND status = 'completed' ORDER BY started_at DESC LIMIT 1`,
    [runDate]
  );
  if (existingRun.rows.length > 0 && triggeredBy === 'cron') {
    console.log(`[social:orchestrator] Already completed for ${runDate} — skipping`);
    return { skipped: true, reason: 'already_completed', existingRunId: existingRun.rows[0].id };
  }

  // ── 3. Create pipeline run ───────────────────────────────────────────────
  await savePipelineRun({
    id: runId,
    run_date: runDate,
    status: 'running',
    triggered_by: triggeredBy,
    triggered_email: triggeredEmail,
    dry_run: dryRun,
  });

  // ── 4. Build PipelineContext ──────────────────────────────────────────────
  const ctx = {
    runId,
    runDate,
    weeklyTheme: null,
    todaysGames: [],
    contentAngle: null,
    competitorInsights: [],
    knowledgeBase: [],
    unifiedMemory: [],
    linkedin: null,
    instagram: null,
    tiktok: null,
    approvalStatus: 'pending',
    linkedinPostDbId: null,
    instagramPostDbId: null,
    tiktokPostDbId: null,
    publishResults: {},
    agentLog: {},
    errors: [],
  };

  try {
    // Load context data
    ctx.todaysGames = await getTodaysGames();
    ctx.knowledgeBase = await loadKnowledgeBase();
    ctx.unifiedMemory = await loadTopMemories();

    console.log(`[social:orchestrator] Context: ${ctx.todaysGames.length} games, ${ctx.knowledgeBase.length} KB entries, ${ctx.unifiedMemory.length} memories`);

    // ── 5. Run agents in sequence ──────────────────────────────────────────
    console.log('[social:orchestrator] → contentCalendar');
    await getWeeklyTheme(ctx);

    console.log('[social:orchestrator] → growthStrategy');
    await analyzeAndRecommend(ctx);

    console.log('[social:orchestrator] → contentCreator');
    await generateContent(ctx);

    console.log('[social:orchestrator] → visualCreator');
    await generateVisuals(ctx);

    console.log('[social:orchestrator] → seoGeo');
    await optimize(ctx);

    // ── 6. Save posts to DB ────────────────────────────────────────────────
    if (ctx.linkedin?.caption) {
      ctx.linkedinPostDbId = await savePost({
        pipeline_run_id: runId,
        platform: 'linkedin',
        caption: ctx.linkedin.caption,
        final_caption: ctx.linkedin.finalCaption,
        hashtags: ctx.linkedin.hashtags,
        media_type: ctx.linkedin.mediaType || 'image',
        image_prompt: ctx.linkedin.imagePrompt,
        image_url: ctx.linkedin.imageUrl,
        image_base64: ctx.linkedin.imageUrl?.startsWith('data:') ? ctx.linkedin.imageUrl : null,
        geo_content: ctx.linkedin.geoContent,
        status: 'pending_approval',
      });
    }

    if (ctx.instagram?.caption) {
      ctx.instagramPostDbId = await savePost({
        pipeline_run_id: runId,
        platform: 'instagram',
        caption: ctx.instagram.caption,
        final_caption: ctx.instagram.finalCaption,
        hashtags: ctx.instagram.hashtags,
        media_type: ctx.instagram.mediaType || 'image',
        image_prompt: ctx.instagram.imagePrompt,
        image_url: ctx.instagram.imageUrl,
        image_base64: ctx.instagram.imageUrl?.startsWith('data:') ? ctx.instagram.imageUrl : null,
        status: 'pending_approval',
      });
    }

    if (ctx.tiktok?.caption) {
      ctx.tiktokPostDbId = await savePost({
        pipeline_run_id: runId,
        platform: 'tiktok',
        caption: ctx.tiktok.caption,
        final_caption: ctx.tiktok.finalCaption,
        hashtags: ctx.tiktok.hashtags,
        media_type: ctx.tiktok.mediaType || 'video',
        video_prompt: ctx.tiktok.videoPrompt,
        video_url: ctx.tiktok.videoUrl,
        hook_he: ctx.tiktok.hookHe,
        hook_en: ctx.tiktok.hookEn,
        overlay_lines: ctx.tiktok.overlayLines,
        cta: ctx.tiktok.cta,
        script: ctx.tiktok.script,
        status: 'pending_approval',
      });
    }

    // ── 7. Auto-publish if configured ──────────────────────────────────────
    if (config.auto_approve === 'true' && !dryRun) {
      console.log('[social:orchestrator] Auto-approve enabled → publishing');
      // Approve all posts
      if (ctx.linkedinPostDbId) await updatePostStatus(ctx.linkedinPostDbId, 'approved', 'auto');
      if (ctx.instagramPostDbId) await updatePostStatus(ctx.instagramPostDbId, 'approved', 'auto');
      if (ctx.tiktokPostDbId) await updatePostStatus(ctx.tiktokPostDbId, 'approved', 'auto');

      await publish(ctx);
    }

    // ── 8. Finalize ────────────────────────────────────────────────────────
    await savePipelineRun({
      id: runId,
      run_date: runDate,
      status: ctx.errors.length > 0 ? 'completed' : 'completed',
      weekly_theme: ctx.weeklyTheme,
      content_angle: ctx.contentAngle,
      agent_log: ctx.agentLog,
      errors: ctx.errors.length > 0 ? ctx.errors : null,
    });

    // Emit socket event if available
    try {
      const { app } = require('../../app');
      const io = app.get('io');
      if (io) {
        io.emit('social:pipeline_complete', {
          runId,
          postsCreated: [ctx.linkedinPostDbId, ctx.instagramPostDbId, ctx.tiktokPostDbId].filter(Boolean).length,
          errors: ctx.errors.length,
        });
      }
    } catch (_) {}

    console.log(`[social:orchestrator] ✅ Pipeline completed (${ctx.errors.length} errors)`);
    return {
      runId,
      postsCreated: [ctx.linkedinPostDbId, ctx.instagramPostDbId, ctx.tiktokPostDbId].filter(Boolean).length,
      errors: ctx.errors,
      agentLog: ctx.agentLog,
    };

  } catch (err) {
    console.error('[social:orchestrator] ❌ Pipeline failed:', err.message);
    ctx.errors.push({ agent: 'orchestrator', error: err.message });

    await savePipelineRun({
      id: runId,
      run_date: runDate,
      status: 'failed',
      agent_log: ctx.agentLog,
      errors: ctx.errors,
    });

    return { runId, error: err.message, errors: ctx.errors };
  }
}

async function updatePostStatus(postId, status, approvedBy) {
  await pool.query(
    `UPDATE social_posts SET status = $1, approved_by = $2, updated_at = NOW() WHERE id = $3`,
    [status, approvedBy, postId]
  );
}

module.exports = { runDailySocialMediaPipeline };
