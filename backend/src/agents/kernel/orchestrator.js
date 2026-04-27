const { agentsPool: pool } = require('../../config/database');
const { executeTask } = require('./taskRunner');
const { loadAllSkills } = require('./skillLoader');
const { v4: uuidv4 } = require('uuid');
const TicketManager = require('./ticketManager');

/**
 * Orchestrator
 * Master pipeline controller. Checks out tasks for agents.
 */
async function initPipelineRun({ dryRun = false, isCron = false, companyId = null } = {}) {
  const runId = uuidv4();
  const runDate = new Date().toISOString().split('T')[0];
  
  if (isCron) {
    const existing = await pool.query(`SELECT id FROM social_pipeline_runs WHERE run_date = $1 AND status != 'failed'`, [runDate]);
    if (existing.rows.length > 0) {
      return { runId: existing.rows[0].id, isNew: false };
    }
  }

  // 1. Create pipeline run with companyId
  await pool.query(
    `INSERT INTO social_pipeline_runs (id, run_date, status, started_at, dry_run, company_id) VALUES ($1, $2, 'running', NOW(), $3, $4)`,
    [runId, runDate, dryRun, companyId]
  );
  
  return { runId, isNew: true };
}

async function runPipeline(runId, options = {}) {
  const { platform, contentMode, issueId = null } = options;
  if (!runId) return { success: false, error: 'No runId provided' };

  if (issueId) {
    await TicketManager.updateIssue(issueId, { status: 'in_progress' });
  }

  const rosterRes = await pool.query(`SELECT * FROM agent_roster WHERE enabled = true`);
  const activeAgents = rosterRes.rows.map(r => r.skill_name);

  // Default flow — media agent injected before draft-packager based on platform/mode
  const pipelineSequence = [
    'research-agent',
    'strategy-agent',
    'creative-content-agent',
    'seo-geo-agent',
  ];

  if (platform === 'tiktok' || platform === 'instagram-reels') {
    pipelineSequence.push('remotion-video-agent');
  } else if (contentMode === 'podcast') {
    pipelineSequence.push('notebooklm-agent');
  } else if (contentMode === 'slides') {
    pipelineSequence.push('notebooklm-agent');
  } else if (contentMode === 'infographic') {
    pipelineSequence.push('nano-banana-agent');
  }

  pipelineSequence.push('draft-packager');

  const loadedSkills = await loadAllSkills();
  let ctx = { 
    contentMode: contentMode || 'standard',
    platform: platform || 'all',
    issueId: issueId
  };

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

    if (result.waiting) {
      await pool.query(`UPDATE social_pipeline_runs SET status = 'awaiting_approval' WHERE id = $1`, [runId]);
      return { success: true, runId, status: 'awaiting_approval', context: ctx };
    }

    // Accumulate context — text payload only to avoid token explosion
    const outputText = result.output?.text ?? result.output;
    ctx[skillName] = typeof outputText === 'string' ? outputText : JSON.stringify(outputText);
    // Propagate media result so draft-packager can include media_url/media_type
    if (result.output?.media) {
      ctx[`${skillName}__media`] = result.output.media;
    }
  }


  
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
          const mediaUrl = draft.media_url || null;
          const mediaType = draft.media_type || null;
          await pool.query(
            `INSERT INTO social_posts (pipeline_run_id, platform, caption, hashtags, status, media_url, media_type)
             VALUES ($1, $2, $3, $4::text[], 'draft', $5, $6)`,
            [runId, platform, draft.caption || '', hashtags, mediaUrl, mediaType]
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
  await pool.query(`UPDATE social_pipeline_runs SET draft_count = $1, status = 'completed', finished_at = NOW() WHERE id = $2`, [savedDraftCount, runId]);

  if (issueId) {
    await TicketManager.updateIssue(issueId, { status: 'done', result: ctx });
  }

  return { success: true, runId, draftCount: savedDraftCount, context: ctx };
}

/**
 * Stage B: Executes a single skill/agent for a specific issue
 */
async function runSkill(runId, skillName, options = {}) {
  const { issueId = null, input = {} } = options;
  const loadedSkills = await loadAllSkills();
  const skillConfig = loadedSkills.find(s => s.name === skillName);
  
  if (!skillConfig) throw new Error(`Skill ${skillName} not found`);

  // Stage C Prep: Lock the agent to prevent overlaps
  await pool.query(`UPDATE agent_roster SET is_running = true WHERE skill_name = $1`, [skillName]);

  try {
    if (issueId) {
      await TicketManager.updateIssue(issueId, { status: 'in_progress' });
    }

    // Create sub-task
    const taskRes = await pool.query(
      `INSERT INTO agent_tasks (run_id, skill_name, stage, status, input) VALUES ($1, $2, $3, 'queued', $4) RETURNING *`,
      [runId, skillName, skillName, JSON.stringify(input)]
    );
    
    const result = await executeTask(taskRes.rows[0], skillConfig, {});

    if (issueId) {
      const status = result.success ? 'done' : 'failed';
      await TicketManager.updateIssue(issueId, { status, result: result.output });
    }

    return result;
  } finally {
    // Stage C Prep: Unlock the agent
    await pool.query(`UPDATE agent_roster SET is_running = false WHERE skill_name = $1`, [skillName]);
  }
}

module.exports = {
  initPipelineRun,
  runPipeline,
  runSkill
};
