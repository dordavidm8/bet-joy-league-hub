/**
 * routes/advisor.js – יועץ AI
 *
 * POST /advisor/:gameId         – שיחה עם יועץ AI (תגובת JSON מלאה)
 * GET  /advisor/:gameId/stream  – שיחה עם יועץ AI (Server-Sent Events streaming)
 *
 * מגבלה: 20 הודעות ליום לכל משתמש (נספרות ב-advisor_usage table).
 * הנתיב stream שולח chunks בזמן אמת כשה-LLM מייצר תגובה.
 * משתמש ב-advisorService.js לכל לוגיקת ה-LLM.
 */
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { chat, chatStream } = require('../services/advisorService');

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return 'messages array is required';
  for (const m of messages) {
    if (!['user', 'assistant'].includes(m.role) || typeof m.content !== 'string') return 'Invalid message format';
    if (m.content.length > 500) return 'הודעה ארוכה מדי (מקסימום 500 תווים)';
  }
  if (messages.length > 20) return 'שיחה ארוכה מדי';
  return null;
}

// POST /api/advisor/:gameId — regular JSON response
router.post('/:gameId', authenticate, async (req, res, next) => {
  const err = validateMessages(req.body.messages);
  if (err) return res.status(400).json({ error: err });
  try {
    const { reply, remaining } = await chat(req.params.gameId, req.user.id, req.body.messages);
    res.json({ reply, remaining });
  } catch (e) {
    if (e.message === 'Game not found') return res.status(404).json({ error: 'משחק לא נמצא' });
    if (e.status === 429) return res.status(429).json({ error: 'הגעת למגבלת השימוש היומית (20 הודעות)' });
    if (e.status === 403) return res.status(403).json({ error: e.message });
    next(e);
  }
});

// GET /api/advisor/:gameId/stream?messages=... — SSE streaming
router.get('/:gameId/stream', authenticate, async (req, res) => {
  let messages;
  try {
    messages = JSON.parse(req.query.messages || '[]');
  } catch {
    return res.status(400).json({ error: 'Invalid messages JSON' });
  }

  const validErr = validateMessages(messages);
  if (validErr) return res.status(400).json({ error: validErr });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    await chatStream(req.params.gameId, req.user.id, messages, send);
  } catch (e) {
    send('error', { message: e.message });
  } finally {
    res.end();
  }
});

module.exports = router;
