const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { logAdminAction } = require('../services/adminLogService');

router.use(authenticate, requireAdmin);

// GET /api/admin/stats?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/stats', async (req, res, next) => {
  try {
    const from = req.query.from ? new Date(req.query.from) : null;
    const to   = req.query.to   ? new Date(req.query.to)   : null;
    const dateFilter = (col) => {
      if (from && to)   return `AND ${col} BETWEEN $1 AND $2`;
      if (from)         return `AND ${col} >= $1`;
      if (to)           return `AND ${col} <= $1`;
      return '';
    };
    const dateParams = [from, to].filter(Boolean);

    const [users, bets, leagues, txByType] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS total_users,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day') AS new_today,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS new_this_month
        FROM users`),
      pool.query(
        `SELECT COUNT(*) AS total_bets,
          COUNT(*) FILTER (WHERE status = 'pending') AS pending,
          COUNT(*) FILTER (WHERE status = 'won') AS won,
          COUNT(*) FILTER (WHERE status = 'lost') AS lost,
          COUNT(*) FILTER (WHERE is_live_bet = true) AS live_bets,
          COALESCE(SUM(stake), 0) AS total_staked,
          COALESCE(SUM(actual_payout) FILTER (WHERE status = 'won'), 0) AS total_paid_out
         FROM bets WHERE true ${dateFilter('placed_at')}`,
        dateParams
      ),
      pool.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'active') AS active FROM leagues`),
      pool.query(
        `SELECT type, SUM(ABS(amount)) AS volume, COUNT(*) AS count
         FROM point_transactions WHERE true ${dateFilter('created_at')}
         GROUP BY type ORDER BY volume DESC`,
        dateParams
      ),
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

// GET /api/admin/leagues — all leagues
router.get('/leagues', async (req, res, next) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const offset = parseInt(req.query.offset) || 0;
  try {
    const result = await pool.query(
      `SELECT l.*,
              u.username AS creator_username,
              (SELECT COUNT(*) FROM league_members lm WHERE lm.league_id = l.id AND lm.is_active = true) AS member_count
       FROM leagues l
       JOIN users u ON u.id = l.creator_id
       ORDER BY l.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json({ leagues: result.rows });
  } catch (err) { next(err); }
});

// POST /api/admin/users/:id/adjust-points
router.post('/users/:id/adjust-points', async (req, res, next) => {
  const { amount, reason } = req.body;
  if (!amount || !reason) return res.status(400).json({ error: 'amount and reason required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userRes = await client.query(
      `UPDATE users SET points_balance = points_balance + $1 WHERE id = $2 RETURNING username, points_balance`,
      [amount, req.params.id]
    );
    if (!userRes.rows[0]) return res.status(404).json({ error: 'User not found' });
    const oldBalance = userRes.rows[0].points_balance - parseInt(amount);
    await client.query(
      `INSERT INTO point_transactions (user_id, amount, type, description)
       VALUES ($1, $2, 'admin_adjustment', $3)`,
      [req.params.id, amount, reason]
    );
    await client.query('COMMIT');
    await logAdminAction(req.user.email, 'adjust_points', 'user', req.params.id, { username: userRes.rows[0].username, amount: parseInt(amount), old_balance: oldBalance, reason });
    res.json({ message: 'Points adjusted', user: userRes.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

// POST /api/admin/notify — send notification to all users or a specific user (by username)
router.post('/notify', async (req, res, next) => {
  const { type, title, body, target } = req.body; // target: 'all' | username string
  if (!type || !title) return res.status(400).json({ error: 'type and title required' });
  if (!['special_offer', 'admin_message'].includes(type)) {
    return res.status(400).json({ error: 'type must be special_offer or admin_message' });
  }
  const { createNotification } = require('../services/notificationService');
  try {
    let userIds = [];
    if (!target || target === 'all') {
      const result = await pool.query(`SELECT id FROM users`);
      userIds = result.rows.map(r => r.id);
    } else {
      const result = await pool.query(`SELECT id FROM users WHERE username ILIKE $1`, [target]);
      if (!result.rows[0]) return res.status(404).json({ error: 'משתמש לא נמצא' });
      userIds = [result.rows[0].id];
    }
    for (const userId of userIds) {
      await createNotification(userId, { type, title, body });
    }
    res.json({ message: 'Notifications sent', sent_to: userIds.length });
  } catch (err) { next(err); }
});

// GET /api/admin/quiz — list all quiz questions
router.get('/quiz', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT * FROM quiz_questions ORDER BY created_at DESC LIMIT 200`
    );
    res.json({ questions: result.rows });
  } catch (err) { next(err); }
});

// DELETE /api/admin/quiz/:id — deactivate a quiz question
router.delete('/quiz/:id', async (req, res, next) => {
  try {
    await pool.query(`UPDATE quiz_questions SET is_active = false WHERE id = $1`, [req.params.id]);
    await logAdminAction(req.user.email, 'delete_quiz_question', 'quiz_question', req.params.id, null);
    res.json({ message: 'Question deactivated' });
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
    await logAdminAction(req.user.email, 'add_quiz_question', 'quiz_question', result.rows[0].id, { question_text });
    res.status(201).json({ question: result.rows[0] });
  } catch (err) { next(err); }
});

// POST /api/admin/quiz/generate — generate quiz question using AI
router.post('/quiz/generate', async (req, res, next) => {
  const { category } = req.body;
  if (!category) return res.status(400).json({ error: 'category required' });
  try {
    const { generateQuizQuestion } = require('../services/aiAdminService');
    const question = await generateQuizQuestion(category);
    res.json({ question });
  } catch (err) { next(err); }
});

// ── MiniGames ─────────────────────────────────────────────────────────────────

// GET /api/admin/minigames/drafts
router.get('/minigames/drafts', async (req, res, next) => {
  try {
    const { generateAllMiniGamesDrafts } = require('../jobs/generateMiniGames');
    const drafts = await generateAllMiniGamesDrafts();
    res.json({ drafts });
  } catch (err) { next(err); }
});

// POST /api/admin/minigames/save-drafts
router.post('/minigames/save-drafts', async (req, res, next) => {
  const { games } = req.body;
  if (!games || !Array.isArray(games)) return res.status(400).json({ error: 'games array required' });
  try {
    const { saveMiniGame } = require('../jobs/generateMiniGames');
    for (const g of games) {
      await saveMiniGame(g);
    }
    await logAdminAction(req.user.email, 'approve_mini_games', 'minigame_draft', null, { count: games.length });
    res.json({ message: 'Mini-games saved successfully for today.' });
  } catch (err) { next(err); }
});

// ── Featured Match ────────────────────────────────────────────────────────────

// POST /api/admin/games/:id/feature
router.post('/games/:id/feature', async (req, res, next) => {
  const { bonus_pct, hours_before } = req.body;
  if (!bonus_pct || bonus_pct < 1 || bonus_pct > 500) {
    return res.status(400).json({ error: 'bonus_pct must be 1–500' });
  }
  try {
    const result = await pool.query(
      `UPDATE games SET is_featured = true, featured_bonus_pct = $1,
        featured_notif_hours = $2, featured_notif_sent = false
       WHERE id = $3 RETURNING id, home_team, away_team`,
      [bonus_pct, hours_before || 2, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Game not found' });
    await logAdminAction(req.user.email, 'feature_game', 'game', req.params.id, { bonus_pct, hours_before });
    res.json({ message: 'Game featured', game: result.rows[0] });
  } catch (err) { next(err); }
});

// DELETE /api/admin/games/:id/feature
router.delete('/games/:id/feature', async (req, res, next) => {
  try {
    await pool.query(
      `UPDATE games SET is_featured = false, featured_bonus_pct = 0, featured_notif_sent = false WHERE id = $1`,
      [req.params.id]
    );
    await logAdminAction(req.user.email, 'unfeature_game', 'game', req.params.id, null);
    res.json({ message: 'Game unfeatured' });
  } catch (err) { next(err); }
});

// GET /api/admin/games/:id/analytics
router.get('/games/:id/analytics', async (req, res, next) => {
  try {
    const gameRes = await pool.query(`SELECT * FROM games WHERE id = $1`, [req.params.id]);
    if (!gameRes.rows[0]) return res.status(404).json({ error: 'Game not found' });

    const analytics = await pool.query(
      `SELECT bq.id AS question_id, bq.question_text, bq.type,
              b.selected_outcome,
              COUNT(b.id) AS bet_count,
              SUM(b.stake) AS total_staked,
              ROUND(COUNT(b.id)::numeric / NULLIF(SUM(COUNT(b.id)) OVER (PARTITION BY bq.id), 0) * 100, 1) AS pct
       FROM bet_questions bq
       JOIN bets b ON b.bet_question_id = bq.id
       WHERE bq.game_id = $1 AND b.status != 'cancelled'
       GROUP BY bq.id, bq.question_text, bq.type, b.selected_outcome
       ORDER BY bq.question_text, total_staked DESC`,
      [req.params.id]
    );

    // Group by question
    const grouped = {};
    for (const row of analytics.rows) {
      if (!grouped[row.question_id]) {
        grouped[row.question_id] = { question_text: row.question_text, type: row.type, outcomes: [] };
      }
      grouped[row.question_id].outcomes.push({
        outcome: row.selected_outcome,
        bet_count: parseInt(row.bet_count),
        total_staked: parseInt(row.total_staked),
        pct: parseFloat(row.pct),
      });
    }

    res.json({ game: gameRes.rows[0], questions: Object.values(grouped) });
  } catch (err) { next(err); }
});

// ── Bet Management ────────────────────────────────────────────────────────────

// GET /api/admin/users/:id/bets
router.get('/users/:id/bets', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT b.*, g.home_team, g.away_team, bq.question_text
       FROM bets b
       JOIN games g ON g.id = b.game_id
       JOIN bet_questions bq ON bq.id = b.bet_question_id
       WHERE b.user_id = $1
       ORDER BY b.placed_at DESC LIMIT 100`,
      [req.params.id]
    );
    res.json({ bets: result.rows });
  } catch (err) { next(err); }
});

// POST /api/admin/bets/:id/cancel
router.post('/bets/:id/cancel', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const betRes = await client.query(`SELECT * FROM bets WHERE id = $1`, [req.params.id]);
    const bet = betRes.rows[0];
    if (!bet) return res.status(404).json({ error: 'Bet not found' });
    if (bet.status !== 'pending') return res.status(400).json({ error: 'Only pending bets can be cancelled' });

    await client.query(`UPDATE bets SET status = 'cancelled', settled_at = NOW() WHERE id = $1`, [bet.id]);
    await client.query(
      `UPDATE users SET points_balance = points_balance + $1, total_bets = total_bets - 1 WHERE id = $2`,
      [bet.stake, bet.user_id]
    );
    await client.query(
      `INSERT INTO point_transactions (user_id, amount, type, reference_id, description)
       VALUES ($1, $2, 'bet_cancelled', $3, 'הימור בוטל על ידי מנהל — הסכום הוחזר')`,
      [bet.user_id, bet.stake, bet.id]
    );

    // If part of a parlay, cancel entire parlay
    if (bet.parlay_id) {
      await client.query(`UPDATE parlays SET status = 'cancelled', settled_at = NOW() WHERE id = $1`, [bet.parlay_id]);
      await client.query(
        `UPDATE bets SET status = 'cancelled', settled_at = NOW() WHERE parlay_id = $1 AND id != $2`,
        [bet.parlay_id, bet.id]
      );
    }

    await client.query('COMMIT');
    await logAdminAction(req.user.email, 'cancel_bet', 'bet', bet.id, { user_id: bet.user_id, stake: bet.stake });
    res.json({ message: 'Bet cancelled and stake refunded' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

// ── Competitions ──────────────────────────────────────────────────────────────

// GET /api/admin/competitions
router.get('/competitions', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT c.*,
              (SELECT COUNT(*) FROM games g WHERE g.competition_id = c.id) AS game_count,
              (SELECT COUNT(*) FROM games g WHERE g.competition_id = c.id AND g.status = 'scheduled') AS upcoming
       FROM competitions c ORDER BY c.is_active DESC, c.name ASC`
    );
    res.json({ competitions: result.rows });
  } catch (err) { next(err); }
});

// PATCH /api/admin/competitions/:id/toggle
router.patch('/competitions/:id/toggle', async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE competitions SET is_active = NOT is_active WHERE id = $1 RETURNING id, name, is_active`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Competition not found' });
    await logAdminAction(req.user.email, 'toggle_competition', 'competition', req.params.id, { is_active: result.rows[0].is_active });
    res.json({ competition: result.rows[0] });
  } catch (err) { next(err); }
});

// ── Admin Action Log ──────────────────────────────────────────────────────────

// GET /api/admin/log
router.get('/log', async (req, res, next) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  try {
    const result = await pool.query(
      `SELECT * FROM admin_action_log ORDER BY created_at DESC LIMIT $1`, [limit]
    );
    res.json({ log: result.rows });
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
