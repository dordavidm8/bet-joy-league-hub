const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');

// GET /api/users/me/stats
router.get('/me/stats', authenticate, async (req, res, next) => {
  try {
    const stats = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status != 'void') AS total_bets,
         COUNT(*) FILTER (WHERE status = 'won') AS wins,
         COUNT(*) FILTER (WHERE status = 'lost') AS losses,
         COALESCE(SUM(actual_payout) FILTER (WHERE status = 'won'), 0) AS total_won,
         COALESCE(SUM(stake) FILTER (WHERE status = 'lost'), 0) AS total_lost
       FROM bets WHERE user_id = $1`,
      [req.user.id]
    );
    res.json({ stats: stats.rows[0], points_balance: req.user.points_balance });
  } catch (err) { next(err); }
});

// GET /api/users/me/bets
router.get('/me/bets', authenticate, async (req, res, next) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = parseInt(req.query.offset) || 0;
  const status = req.query.status;
  try {
    const params = [req.user.id, limit, offset];
    const whereStatus = status ? `AND b.status = $4` : '';
    if (status) params.push(status);
    const result = await pool.query(
      `SELECT b.*, g.home_team, g.away_team, g.start_time, bq.question_text
       FROM bets b
       JOIN games g ON g.id = b.game_id
       JOIN bet_questions bq ON bq.id = b.bet_question_id
       WHERE b.user_id = $1 ${whereStatus}
       ORDER BY b.placed_at DESC LIMIT $2 OFFSET $3`,
      params
    );
    res.json({ bets: result.rows });
  } catch (err) { next(err); }
});

// GET /api/users/me/transactions
router.get('/me/transactions', authenticate, async (req, res, next) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = parseInt(req.query.offset) || 0;
  try {
    const result = await pool.query(
      `SELECT * FROM point_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );
    res.json({ transactions: result.rows });
  } catch (err) { next(err); }
});

// GET /api/users/me/referral-code
router.get('/me/referral-code', authenticate, (req, res) => {
  res.json({ referral_code: req.user.id, username: req.user.username });
});

// DELETE /api/users/me — delete account
router.delete('/me', authenticate, async (req, res, next) => {
  const admin = require('../config/firebase');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE bets SET status = 'cancelled' WHERE user_id = $1 AND status = 'pending'`, [req.user.id]);
    await client.query(`DELETE FROM league_members WHERE user_id = $1`, [req.user.id]);
    await client.query(`DELETE FROM quiz_attempts WHERE user_id = $1`, [req.user.id]);
    await client.query(`DELETE FROM point_transactions WHERE user_id = $1`, [req.user.id]);
    await client.query(`DELETE FROM users WHERE id = $1`, [req.user.id]);
    // Delete from Firebase Auth
    if (process.env.STUB_MODE !== 'true') {
      await admin.auth().deleteUser(req.user.firebase_uid);
    }
    await client.query('COMMIT');
    res.json({ message: 'Account deleted' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

// PATCH /api/users/me/avatar
router.patch('/me/avatar', authenticate, async (req, res, next) => {
  const { avatar_url } = req.body;
  if (!avatar_url) return res.status(400).json({ error: 'avatar_url required' });
  try {
    const result = await pool.query(
      `UPDATE users SET avatar_url = $1 WHERE id = $2 RETURNING *`,
      [avatar_url, req.user.id]
    );
    res.json({ user: result.rows[0] });
  } catch (err) { next(err); }
});

// GET /api/users/:username — public profile
router.get('/:username', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, username, avatar_url, total_bets, total_wins, created_at FROM users WHERE username = $1`,
      [req.params.username]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ user: result.rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
