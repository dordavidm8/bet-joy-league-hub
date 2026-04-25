const express = require('express');
const router = express.Router();
const { pool } = require('../../config/database');
const { initPipelineRun, runPipeline } = require('../agents/kernel/orchestrator');
const eventBus = require('../agents/kernel/eventBus');

// GET /api/agents/roster
router.get('/roster', async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT * FROM agent_roster ORDER BY created_at ASC`);
    res.json({ roster: result.rows });
  } catch (err) { next(err); }
});

// POST /api/agents/runs
router.post('/runs', async (req, res, next) => {
  try {
    const { runId, isNew } = await initPipelineRun({ dryRun: req.body.dryRun || false, isCron: req.body.isCron || false });
    res.json({ message: 'Pipeline V2 triggered', runId, isNew });
    
    // Only run if it's a new pipeline to prevent duplicate background execution
    if (isNew) {
      runPipeline(runId).catch(console.error);
    }
  } catch (err) { next(err); }
});

// GET /api/agents/runs/:id
router.get('/runs/:id', async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT * FROM social_pipeline_runs WHERE id = $1`, [req.params.id]);
    res.json({ run: result.rows[0] });
  } catch (err) { next(err); }
});

// GET /api/agents/runs/:id/tasks
router.get('/runs/:id/tasks', async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT * FROM agent_tasks WHERE run_id = $1 ORDER BY started_at ASC`, [req.params.id]);
    res.json({ tasks: result.rows });
  } catch (err) { next(err); }
});

// GET /api/agents/runs/:id/stream - Server-Sent Events (SSE)
router.get('/runs/:id/stream', async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no' // Prevent Nginx buffering
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

  // Register live handlers FIRST to close the race condition gap
  eventBus.on('stage_started', handlerMap['stage_started']);
  eventBus.on('stage_completed', handlerMap['stage_completed']);
  eventBus.on('stage_failed', handlerMap['stage_failed']);

  // 1. Initial hydration to fix race conditions (fetch all relevant tasks)
  try {
    const pastTasks = await pool.query(
      `SELECT skill_name, status FROM agent_tasks WHERE run_id = $1 AND status != 'queued' ORDER BY started_at ASC`, 
      [req.params.id]
    );
    // Send started for ALL retrieved tasks first (since UI needs started to draw the running state)
    pastTasks.rows.forEach(t => {
      sendEvent('stage_started', { runId: req.params.id, agent: t.skill_name });
      // If completed or failed, send the finale event too
      if (t.status === 'success') {
        sendEvent('stage_completed', { runId: req.params.id, agent: t.skill_name });
      } else if (t.status === 'failed') {
        sendEvent('stage_failed', { runId: req.params.id, agent: t.skill_name });
      }
    });
  } catch(e) { console.error("SSE Initial Hydration Error", e); }

  // 2. Heartbeat to keep connection alive
  const heartbeat = setInterval(() => res.write(`:\n\n`), 45000);

  req.on('close', () => {
    clearInterval(heartbeat);
    eventBus.removeListener('stage_started', handlerMap['stage_started']);
    eventBus.removeListener('stage_completed', handlerMap['stage_completed']);
    eventBus.removeListener('stage_failed', handlerMap['stage_failed']);
  });
});

// GET /api/agents/posts - List generated social posts
router.get('/posts', async (req, res, next) => {
  try {
    const { status, platform } = req.query;
    let query = `SELECT * FROM social_posts WHERE 1=1`;
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    if (platform) {
      params.push(platform);
      query += ` AND platform = $${params.length}`;
    }

    query += ` ORDER BY created_at DESC LIMIT 50`;
    
    const result = await pool.query(query, params);
    res.json({ posts: result.rows });
  } catch (err) { next(err); }
});

module.exports = router;
