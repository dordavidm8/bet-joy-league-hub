const { pool } = require('../../config/database');
const { executeTask } = require('./taskRunner');
const { loadAllSkills } = require('./skillLoader');
const { v4: uuidv4 } = require('uuid');

/**
 * Orchestrator
 * Master pipeline controller. Checks out tasks for agents.
 */
async function initPipelineRun({ dryRun = false, isCron = false } = {}) {
  const runId = uuidv4();
  const runDate = new Date().toISOString().split('T')[0];
  if (isCron) {
    const existing = await pool.query(`SELECT id FROM social_pipeline_runs WHERE run_date = $1 AND status != 'failed'`, [runDate]);
    if (existing.rows.length > 0) {
      return { runId: existing.rows[0].id, isNew: false };
    }
  }

  // 1. Create pipeline run
  await pool.query(
    `INSERT INTO social_pipeline_runs (id, run_date, status, started_at, dry_run) VALUES ($1, $2, 'running', NOW(), $3)`,
    [runId, runDate, dryRun]
  );
  
  return { runId, isNew: true };
}

async function runPipeline(runId) {
  if (!runId) return { success: false, error: 'No runId provided' };

  const rosterRes = await pool.query(`SELECT * FROM agent_roster WHERE enabled = true`);
  const activeAgents = rosterRes.rows.map(r => r.skill_name);

  // Default flow
  const pipelineSequence = [
    'research-agent',
    'strategy-agent',
    'creative-content-agent',
    'seo-geo-agent',
    'draft-packager'
  ];

  const loadedSkills = await loadAllSkills();
  let ctx = {};

  // For each agent in sequence
  for (const skillName of pipelineSequence) {
    if (!activeAgents.includes(skillName)) continue;
    
    const skillConfig = loadedSkills.find(s => s.name === skillName);
    if (!skillConfig) continue;

    // Create task
    const taskRes = await pool.query(
      `INSERT INTO agent_tasks (run_id, skill_name, stage, status, input) VALUES ($1, $2, $3, 'queued', $4) RETURNING *`,
      [runId, skillName, skillName, JSON.stringify(ctx)]
    );
    const task = taskRes.rows[0];

    // Execute
    const result = await executeTask(task, skillConfig, {});
    
    if (!result.success) {
      await pool.query(`UPDATE social_pipeline_runs SET status = 'failed' WHERE id = $1`, [runId]);
      return { success: false, error: result.error, runId };
    }

    // Bug #2 Fix: Accumulate context but only keep text payload to avoid token explosion
    const outputText = result.output?.text ?? result.output;
    ctx[skillName] = typeof outputText === 'string' ? outputText : JSON.stringify(outputText);
  }

  await pool.query(`UPDATE social_pipeline_runs SET status = 'completed', finished_at = NOW() WHERE id = $1`, [runId]);
  
  // Tally saved drafts and write to pipeline run summary  
  let savedDraftCount = 0;
  const VALID_PLATFORMS = ['linkedin', 'instagram', 'tiktok'];
  const draftsOutput = ctx['draft-packager'];
  
  if (!draftsOutput) {
    // draft-packager didn't run (disabled in roster or skill missing)
    const warningMsg = 'draft-packager did not run - DraftsInbox will be empty';
    console.warn(`[orchestrator] ${warningMsg}`);
    await pool.query(`UPDATE social_pipeline_runs SET warning = $1 WHERE id = $2`, [warningMsg, runId]);
  } else {
    let drafts = null;
    try {
      const parsed = typeof draftsOutput === 'string' ? JSON.parse(draftsOutput) : draftsOutput;
      drafts = parsed?.drafts ?? (Array.isArray(parsed) ? parsed : null);
    } catch(e) {
      console.error('[orchestrator] Could not parse draft-packager output:', e);
    }

    if (drafts && drafts.length > 0) {
      for (const draft of drafts) {
        const platform = VALID_PLATFORMS.includes(draft.platform) ? draft.platform : 'instagram';
        const hashtags = Array.isArray(draft.tags) ? draft.tags : (Array.isArray(draft.hashtags) ? draft.hashtags : []);
        try {
          await pool.query(
            `INSERT INTO social_posts (pipeline_run_id, platform, caption, hashtags, status)
             VALUES ($1, $2, $3, $4::text[], 'draft')`,
            [runId, platform, draft.caption || '', hashtags]
          );
          savedDraftCount++;
        } catch(insertErr) {
          console.error('[orchestrator] Failed INSERT into social_posts:', insertErr.message);
          await pool.query(`UPDATE social_pipeline_runs SET status = 'failed' WHERE id = $1`, [runId]);
          return { success: false, error: `social_posts insert failed: ${insertErr.message}`, runId };
        }
      }
    } else {
      const warningMsg = 'draft-packager returned no drafts array';
      console.warn(`[orchestrator] ${warningMsg}`);
      await pool.query(`UPDATE social_pipeline_runs SET warning = $1 WHERE id = $2`, [warningMsg, runId]);
    }
  }

  // Persist the final draft count
  await pool.query(`UPDATE social_pipeline_runs SET draft_count = $1 WHERE id = $2`, [savedDraftCount, runId]);

  return { success: true, runId, draftCount: savedDraftCount };
}

module.exports = {
  initPipelineRun,
  runPipeline
};
