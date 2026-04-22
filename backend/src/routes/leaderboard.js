const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');

// GET /api/leaderboard/global
router.get('/global', async (req, res, next) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  try {
    const result = await pool.query(
      `SELECT id, username, display_name, avatar_url, points_balance, total_bets, total_wins,
              RANK() OVER (ORDER BY points_balance DESC) AS rank
       FROM users 
       WHERE username NOT LIKE 'deleted_%'
       ORDER BY points_balance DESC LIMIT $1`,
      [limit]
    );
    res.json({ leaderboard: result.rows });
  } catch (err) { next(err); }
});

// GET /api/leaderboard/me
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT rank FROM (
         SELECT id, RANK() OVER (ORDER BY points_balance DESC) AS rank 
         FROM users
         WHERE username NOT LIKE 'deleted_%'
       ) ranked WHERE id = $1`,
      [req.user.id]
    );

    res.json({ rank: result.rows[0]?.rank || null, points_balance: req.user.points_balance });
  } catch (err) { next(err); }
});

module.exports = router;
