const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { chat } = require('../services/advisorService');

// POST /api/advisor/:gameId
// Body: { messages: [{ role: 'user'|'assistant', content: string }, ...] }
router.post('/:gameId', authenticate, async (req, res, next) => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    // Validate message shape + length
    for (const m of messages) {
      if (!['user', 'assistant'].includes(m.role) || typeof m.content !== 'string') {
        return res.status(400).json({ error: 'Invalid message format' });
      }
      if (m.content.length > 500) {
        return res.status(400).json({ error: 'הודעה ארוכה מדי (מקסימום 500 תווים)' });
      }
    }
    if (messages.length > 20) {
      return res.status(400).json({ error: 'שיחה ארוכה מדי' });
    }

    const { reply, remaining } = await chat(req.params.gameId, req.user.id, messages);
    res.json({ reply, remaining });
  } catch (err) {
    if (err.message === 'Game not found') return res.status(404).json({ error: 'משחק לא נמצא' });
    if (err.status === 429) return res.status(429).json({ error: 'הגעת למגבלת השימוש היומית (20 הודעות)' });
    next(err);
  }
});

module.exports = router;
