const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate, requireAdmin);

// GET /api/admin/stats
router.get('/stats', async (req, res, next) => {
  try {
    const [users, bets, leagues, txByType] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS total_users,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day') AS new_today,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS new_this_month
        FROM users`),
      pool.query(`SELECT COUNT(*) AS total_bets,
        COUNT(*) FILTER (WHERE status = 'pending') AS pending,
        COUNT(*) FILTER (WHERE status = 'won') AS won,
        COUNT(*) FILTER (WHERE status = 'lost') AS lost,
        COUNT(*) FILTER (WHERE is_live_bet = true) AS live_bets,
        COALESCE(SUM(stake), 0) AS total_staked,
        COALESCE(SUM(actual_payout) FILTER (WHERE status = 'won'), 0) AS total_paid_out
        FROM bets`),
      pool.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'active') AS active FROM leagues`),
      pool.query(`SELECT type, SUM(ABS(amount)) AS volume, COUNT(*) AS count FROM point_transactions GROUP BY type ORDER BY volume DESC`),
    ]);
    res.json({ users: users.rows[0], bets: bets.rows[0], leagues: leagues.rows[0], transactions_by_type: txByType.rows });
  } catch (err) { next(err); }
});

// GET /api/admin/users
router.get('/users', async (req, res, next) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;
  const search = req.query.search;
  const params = [limit, offset];
  const where = search ? `WHERE username ILIKE $3 OR email ILIKE $3` : '';
  if (search) params.push(`%${search}%`);
  try {
    const result = await pool.query(
      `SELECT id, firebase_uid, username, email, points_balance, total_bets, total_wins, created_at
       FROM users ${where} ORDER BY created_at DESC LIMIT $1 OFFSET $2`, params
    );
    res.json({ users: result.rows });
  } catch (err) { next(err); }
});

// GET /api/admin/bets
router.get('/bets', async (req, res, next) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;
  const { status, game_id } = req.query;
  const conditions = [], params = [limit, offset];
  if (status) { params.push(status); conditions.push(`b.status = $${params.length}`); }
  if (game_id) { params.push(game_id); conditions.push(`b.game_id = $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  try {
    const result = await pool.query(
      `SELECT b.*, u.username, g.home_team, g.away_team FROM bets b
       JOIN users u ON u.id = b.user_id JOIN games g ON g.id = b.game_id
       ${where} ORDER BY b.placed_at DESC LIMIT $1 OFFSET $2`, params
    );
    res.json({ bets: result.rows });
  } catch (err) { next(err); }
});

// GET /api/admin/games
router.get('/games', async (req, res, next) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;
  try {
    const result = await pool.query(
      `SELECT g.*, c.name AS competition_name,
              (SELECT COUNT(*) FROM bets WHERE game_id = g.id) AS total_bets
       FROM games g LEFT JOIN competitions c ON c.id = g.competition_id
       ORDER BY g.start_time DESC LIMIT $1 OFFSET $2`, [limit, offset]
    );
    res.json({ games: result.rows });
  } catch (err) { next(err); }
});

// POST /api/admin/quiz — add quiz question
router.post('/quiz', async (req, res, next) => {
  const { question_text, options, correct_option, category, game_id, points_reward } = req.body;
  if (!question_text || !options || !correct_option) {
    return res.status(400).json({ error: 'question_text, options, correct_option required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO quiz_questions (question_text, options, correct_option, category, game_id, points_reward)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [question_text, JSON.stringify(options), correct_option, category || 'general', game_id || null, points_reward || 50]
    );
    res.status(201).json({ question: result.rows[0] });
  } catch (err) { next(err); }
});

// ── Ops routes (secret-key protected, no Firebase auth required) ───────────────
const opsRouter = express.Router();

function requireOpsKey(req, res, next) {
  const secret = process.env.OPS_SECRET;
  if (!secret || req.headers['x-ops-key'] !== secret) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

opsRouter.use(requireOpsKey);

// DELETE /api/ops/users/:username — remove a user by username (for cleanup)
opsRouter.delete('/users/:username', async (req, res, next) => {
  const { username } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = await client.query('SELECT id FROM users WHERE username = $1', [username]);
    if (!user.rows[0]) return res.status(404).json({ error: 'User not found' });
    const userId = user.rows[0].id;
    await client.query(`DELETE FROM mini_game_attempts WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM quiz_attempts WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM point_transactions WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM league_members WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
    await client.query('COMMIT');
    res.json({ message: `User '${username}' deleted` });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

// POST /api/ops/generate-minigames — trigger mini-game regeneration
opsRouter.post('/generate-minigames', async (req, res) => {
  const { generateAllMiniGames } = require('../jobs/generateMiniGames');
  res.json({ message: 'Mini-game generation started' });
  generateAllMiniGames().catch(err => console.error('[ops] Mini-game generation error:', err.message));
});

// POST /api/ops/reset-minigame-attempts — clear all attempts for today's puzzles (lets users replay)
opsRouter.post('/reset-minigame-attempts', async (req, res, next) => {
  try {
    // Delete all attempts linked to today's daily mini games
    const result = await pool.query(`
      DELETE FROM mini_game_attempts
      WHERE puzzle_id IN (
        SELECT id FROM daily_mini_games WHERE play_date = CURRENT_DATE
      )
    `);
    // Also update users' points_balance to remove points earned from today's minigames
    // (optional: only remove if explicitly requested)
    res.json({ message: 'Mini-game attempts reset for today', deleted: result.rowCount });
  } catch (err) { next(err); }
});

module.exports = router;
module.exports.opsRouter = opsRouter;
