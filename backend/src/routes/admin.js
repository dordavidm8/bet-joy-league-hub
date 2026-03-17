const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

// All admin routes require authentication + admin role
router.use(authenticate, requireAdmin);

// GET /api/admin/stats — dashboard overview
router.get('/stats', async (req, res, next) => {
  try {
    const [users, bets, leagues, transactions] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) AS total_users,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day') AS new_today,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS new_this_month
        FROM users
      `),
      pool.query(`
        SELECT
          COUNT(*) AS total_bets,
          COUNT(*) FILTER (WHERE status = 'pending') AS pending_bets,
          COUNT(*) FILTER (WHERE status = 'won') AS won_bets,
          COUNT(*) FILTER (WHERE status = 'lost') AS lost_bets,
          COUNT(*) FILTER (WHERE is_live_bet = true) AS live_bets,
          COALESCE(SUM(stake), 0) AS total_staked,
          COALESCE(SUM(actual_payout) FILTER (WHERE status = 'won'), 0) AS total_paid_out
        FROM bets
      `),
      pool.query(`
        SELECT COUNT(*) AS total_leagues,
               COUNT(*) FILTER (WHERE status = 'active') AS active_leagues
        FROM leagues
      `),
      pool.query(`
        SELECT type, SUM(ABS(amount)) AS volume, COUNT(*) AS count
        FROM point_transactions
        GROUP BY type
        ORDER BY volume DESC
      `),
    ]);

    res.json({
      users: users.rows[0],
      bets: bets.rows[0],
      leagues: leagues.rows[0],
      transactions_by_type: transactions.rows,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/users — paginated user list
router.get('/users', async (req, res, next) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;
  const search = req.query.search;

  const params = [limit, offset];
  const where = search
    ? `WHERE username ILIKE $3 OR email ILIKE $3`
    : '';
  if (search) params.push(`%${search}%`);

  try {
    const result = await pool.query(
      `SELECT id, firebase_uid, username, email, points_balance,
              total_bets, total_wins, created_at
       FROM users ${where}
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      params
    );
    const total = await pool.query(`SELECT COUNT(*) FROM users ${where}`, search ? [`%${search}%`] : []);
    res.json({ users: result.rows, total: parseInt(total.rows[0].count) });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/bets — paginated bets with filters
router.get('/bets', async (req, res, next) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;
  const { status, game_id, from, to } = req.query;

  const conditions = [];
  const params = [limit, offset];

  if (status) { params.push(status); conditions.push(`b.status = $${params.length}`); }
  if (game_id) { params.push(game_id); conditions.push(`b.game_id = $${params.length}`); }
  if (from) { params.push(from); conditions.push(`b.placed_at >= $${params.length}`); }
  if (to) { params.push(to); conditions.push(`b.placed_at <= $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const result = await pool.query(
      `SELECT b.*, u.username, g.home_team, g.away_team
       FROM bets b
       JOIN users u ON u.id = b.user_id
       JOIN games g ON g.id = b.game_id
       ${where}
       ORDER BY b.placed_at DESC
       LIMIT $1 OFFSET $2`,
      params
    );
    res.json({ bets: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/games — list all synced games
router.get('/games', async (req, res, next) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;
  try {
    const result = await pool.query(
      `SELECT g.*, c.name AS competition_name,
              (SELECT COUNT(*) FROM bets WHERE game_id = g.id) AS total_bets
       FROM games g
       LEFT JOIN competitions c ON c.id = g.competition_id
       ORDER BY g.start_time DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json({ games: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/quiz — add a quiz question
router.post('/quiz', async (req, res, next) => {
  const { question_text, options, correct_option, category, game_id, points_reward } = req.body;
  if (!question_text || !options || !correct_option) {
    return res.status(400).json({ error: 'question_text, options, and correct_option are required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO quiz_questions (question_text, options, correct_option, category, game_id, points_reward)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        question_text,
        JSON.stringify(options),
        correct_option,
        category || 'general',
        game_id || null,
        points_reward || 50,
      ]
    );
    res.status(201).json({ question: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
