const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');

// POST /api/support
// Create a new support inquiry
router.post('/', authenticate, async (req, res, next) => {
  const { message } = req.body;
  if (!message || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message content is required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO support_inquiries (user_id, message)
       VALUES ($1, $2) RETURNING *`,
      [req.user.id, message.trim()]
    );
    res.status(201).json({ inquiry: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
