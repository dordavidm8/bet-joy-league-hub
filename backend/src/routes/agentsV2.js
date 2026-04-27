const express = require('express');
const router = express.Router();
const { agentsPool: pool } = require('../config/database');
const { initPipelineRun, runPipeline, runSkill } = require('../agents/kernel/orchestrator');
const eventBus = require('../agents/kernel/eventBus');
const { runManualAuth, confirmAuth } = require('../agents/tools/notebookLmAuth');
const TicketManager = require('../agents/kernel/ticketManager');
const ApprovalGate = require('../agents/kernel/approvalGate');

// ── COMPANIES (Stage A) ──────────────────────────────────────────────────

router.get('/companies', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM companies ORDER BY created_at DESC');
    res.json({ companies: result.rows });
  } catch (err) { next(err); }
});

router.post('/companies', async (req, res, next) => {
  try {
    const { name, owner_user_id } = req.body;
    const result = await pool.query(
      'INSERT INTO companies (name, owner_user_id) VALUES ($1, $2) RETURNING *',
      [name, owner_user_id]
    );
    res.json({ company: result.rows[0] });
  } catch (err) { next(err); }
});

// ── ISSUES / TICKETS (Stage B) ───────────────────────────────────────────

router.get('/issues', async (req, res, next) => {
  try {
    const { companyId, status } = req.query;
    const issues = await TicketManager.listIssues(companyId, status);
    res.json({ issues });
  } catch (err) { next(err); }
});

router.post('/issues', async (req, res, next) => {
  try {
    const issue = await TicketManager.createIssue(req.body);
    res.json({ issue });
  } catch (err) { next(err); }
});

router.patch('/issues/:id', async (req, res, next) => {
  try {
    const issue = await TicketManager.updateIssue(req.params.id, req.body);
    res.json({ issue });
  } catch (err) { next(err); }
});

router.post('/issues/:id/run', async (req, res, next) => {
  try {
    const issue = await TicketManager.getIssue(req.params.id);
    if (!issue) return res.status(404).json({ error: 'Issue not found' });
    
    const { runId } = await initPipelineRun({ companyId: issue.company_id });
    
    runSkill(runId, issue.assigned_skill, { 
      issueId: issue.id, 
      input: { issueBody: issue.body, title: issue.title } 
    }).catch(err => console.error('[API] runSkill failed:', err.message));
      
    res.json({ success: true, runId, message: `Skill ${issue.assigned_skill} execution started.` });
  } catch (err) { next(err); }
});

// ── APPROVALS (Stage D) ──────────────────────────────────────────────────

router.get('/approvals', async (req, res, next) => {
  try {
    const { companyId } = req.query;
    const approvals = await ApprovalGate.listPending(companyId);
    res.json({ approvals });
  } catch (err) { next(err); }
});

router.post('/approvals/:id/decide', async (req, res, next) => {
  try {
    const { decision, comment } = req.body;
    const result = await ApprovalGate.decide(req.params.id, { decision, comment });
    res.json(result);
  } catch (err) { next(err); }
});

// ── AGENT MANAGEMENT ──────────────────────────────────────────────────────

router.get('/roster', async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT * FROM agent_roster ORDER BY created_at ASC`);
    res.json({ roster: result.rows });
  } catch (err) { next(err); }
});

// ── PIPELINE EXECUTION ───────────────────────────────────────────────────

router.post('/runs', async (req, res, next) => {
  try {
    const { runId, isNew } = await initPipelineRun({ 
      dryRun: req.body.dryRun || false, 
      isCron: req.body.isCron || false,
      companyId: req.body.companyId
    });
    res.json({ message: 'Pipeline V2 triggered', runId, isNew });
    
    if (isNew) {
      runPipeline(runId, { 
        platform: req.body.platform, 
        contentMode: req.body.contentMode 
      }).catch(console.error);
    }
  } catch (err) { next(err); }
});

router.get('/runs/:id', async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT * FROM social_pipeline_runs WHERE id = $1`, [req.params.id]);
    res.json({ run: result.rows[0] });
  } catch (err) { next(err); }
});

router.get('/runs/:id/tasks', async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT * FROM agent_tasks WHERE run_id = $1 ORDER BY started_at ASC`, [req.params.id]);
    res.json({ tasks: result.rows });
  } catch (err) { next(err); }
});

// Real-time SSE Stream
router.get('/runs/:id/stream', async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const handlerMap = {
    'stage_started': (data) => { if (data.runId === req.params.id) sendEvent('stage_started', Object.assign({}, data, { agent: data.skillName || data.agent })); },
    'stage_completed': (data) => { if (data.runId === req.params.id) sendEvent('stage_completed', Object.assign({}, data, { agent: data.skillName || data.agent })); },
    'stage_failed': (data) => { if (data.runId === req.params.id) sendEvent('stage_failed', Object.assign({}, data, { agent: data.skillName || data.agent })); }
  };

  eventBus.on('stage_started', handlerMap['stage_started']);
  eventBus.on('stage_completed', handlerMap['stage_completed']);
  eventBus.on('stage_failed', handlerMap['stage_failed']);

  try {
    const pastTasks = await pool.query(
      `SELECT skill_name, status FROM agent_tasks WHERE run_id = $1 AND status != 'queued' ORDER BY started_at ASC`, 
      [req.params.id]
    );
    pastTasks.rows.forEach(t => {
      sendEvent('stage_started', { runId: req.params.id, agent: t.skill_name });
      if (t.status === 'success') {
        sendEvent('stage_completed', { runId: req.params.id, agent: t.skill_name });
      } else if (t.status === 'failed') {
        sendEvent('stage_failed', { runId: req.params.id, agent: t.skill_name });
      }
    });
  } catch(e) { console.error("SSE Initial Hydration Error", e); }

  const heartbeat = setInterval(() => res.write(`:\n\n`), 45000);

  req.on('close', () => {
    clearInterval(heartbeat);
    eventBus.removeListener('stage_started', handlerMap['stage_started']);
    eventBus.removeListener('stage_completed', handlerMap['stage_completed']);
    eventBus.removeListener('stage_failed', handlerMap['stage_failed']);
  });
});

// ── ASSETS & MEDIA ────────────────────────────────────────────────────────

router.get('/posts', async (req, res, next) => {
  try {
    const { status, platform } = req.query;
    let query = `SELECT * FROM social_posts WHERE 1=1`;
    const params = [];
    if (status) { params.push(status); query += ` AND status = $${params.length}`; }
    if (platform) { params.push(platform); query += ` AND platform = $${params.length}`; }
    query += ` ORDER BY created_at DESC LIMIT 50`;
    const result = await pool.query(query, params);
    res.json({ posts: result.rows });
  } catch (err) { next(err); }
});

router.get('/knowledge', async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT * FROM knowledge_assets ORDER BY created_at DESC`);
    res.json({ assets: result.rows });
  } catch (err) { next(err); }
});

router.get('/media/:jobId', async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT * FROM media_jobs WHERE id = $1`, [req.params.jobId]);
    res.json({ job: result.rows[0] || null });
  } catch (err) { next(err); }
});

router.post('/notebooklm/auth', runManualAuth);
router.post('/notebooklm/auth/confirm', confirmAuth);

module.exports = router;
