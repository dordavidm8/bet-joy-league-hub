const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticate, optionalAuthenticate } = require('../middleware/auth');
const { getStreak } = require('../services/achievementService');

// GET /api/users/search?q=...
router.get('/search', async (req, res, next) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) return res.json({ users: [] });
  try {
    const result = await pool.query(
      `SELECT id, username, avatar_url, points_balance, total_bets, total_wins
       FROM users WHERE username ILIKE $1 ORDER BY points_balance DESC LIMIT 10`,
      [`${q.trim()}%`]
    );
    res.json({ users: result.rows });
  } catch (err) { next(err); }
});

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
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const offset = parseInt(req.query.offset) || 0;
  const status = req.query.status;
  const search = req.query.search;
  try {
    const params = [req.user.id, limit, offset];
    const conditions = [`b.user_id = $1`];
    if (status) { params.push(status); conditions.push(`b.status = $${params.length}`); }
    if (search) { params.push(`%${search}%`); conditions.push(`(g.home_team ILIKE $${params.length} OR g.away_team ILIKE $${params.length})`); }
    const where = conditions.join(' AND ');
    const result = await pool.query(
      `SELECT b.*, g.home_team, g.away_team, g.start_time, g.score_home, g.score_away,
              bq.question_text, c.name AS competition_name
       FROM bets b
       JOIN games g ON g.id = b.game_id
       JOIN bet_questions bq ON bq.id = b.bet_question_id
       LEFT JOIN competitions c ON c.id = g.competition_id
       WHERE ${where}
       ORDER BY b.placed_at DESC LIMIT $2 OFFSET $3`,
      params
    );
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM bets b JOIN games g ON g.id = b.game_id
       WHERE ${where.replace(/\$2|\$3/g, '')}`,
      params.slice(0, params.length - 2) // without limit/offset
    );
    // Actually simpler: just return rows and let frontend know if more exist
    res.json({ bets: result.rows, total: parseInt(countRes.rows[0].count) });
  } catch (err) { next(err); }
});

// GET /api/users/me/detailed-stats
router.get('/me/detailed-stats', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [summaryRes, byCompetitionRes, monthlyRes] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status IN ('won','lost')) AS total_settled,
           COUNT(*) FILTER (WHERE status = 'won') AS total_wins,
           COUNT(*) FILTER (WHERE status = 'lost') AS total_losses,
           COUNT(*) FILTER (WHERE status = 'pending') AS total_pending,
           COALESCE(SUM(actual_payout) FILTER (WHERE status = 'won'), 0) AS total_returned,
           COALESCE(SUM(stake) FILTER (WHERE status IN ('won','lost')), 0) AS total_staked,
           COALESCE(MAX(actual_payout) FILTER (WHERE status = 'won'), 0) AS biggest_win,
           COALESCE(MAX(odds) FILTER (WHERE status = 'won'), 0) AS best_odds_won,
           COUNT(*) FILTER (WHERE parlay_id IS NOT NULL AND status = 'won') AS parlay_wins
         FROM bets WHERE user_id = $1`,
        [userId]
      ),
      pool.query(
        `SELECT
           COALESCE(c.name, 'Unknown') AS competition_name,
           COUNT(*) FILTER (WHERE b.status = 'won') AS wins,
           COUNT(*) FILTER (WHERE b.status = 'lost') AS losses,
           COUNT(*) AS total
         FROM bets b
         JOIN games g ON g.id = b.game_id
         LEFT JOIN competitions c ON c.id = g.competition_id
         WHERE b.user_id = $1 AND b.status IN ('won','lost')
         GROUP BY c.name
         HAVING COUNT(*) >= 2
         ORDER BY (COUNT(*) FILTER (WHERE b.status = 'won'))::float / COUNT(*) DESC
         LIMIT 5`,
        [userId]
      ),
      pool.query(
        `SELECT
           TO_CHAR(DATE_TRUNC('month', placed_at), 'YYYY-MM') AS month,
           COUNT(*) FILTER (WHERE status = 'won') AS wins,
           COUNT(*) FILTER (WHERE status = 'lost') AS losses,
           COALESCE(SUM(actual_payout) FILTER (WHERE status = 'won'), 0) -
           COALESCE(SUM(stake) FILTER (WHERE status = 'lost'), 0) AS net
         FROM bets WHERE user_id = $1 AND status IN ('won','lost')
         GROUP BY DATE_TRUNC('month', placed_at)
         ORDER BY DATE_TRUNC('month', placed_at) DESC
         LIMIT 6`,
        [userId]
      ),
    ]);

    const streak = await getStreak(userId);
    const s = summaryRes.rows[0];

    res.json({
      summary: {
        total_settled: parseInt(s.total_settled),
        total_wins: parseInt(s.total_wins),
        total_losses: parseInt(s.total_losses),
        total_pending: parseInt(s.total_pending),
        total_staked: parseInt(s.total_staked),
        total_returned: parseInt(s.total_returned),
        net_profit: parseInt(s.total_returned) - parseInt(s.total_staked),
        win_rate: s.total_settled > 0 ? Math.round((s.total_wins / s.total_settled) * 100) : 0,
        biggest_win: parseInt(s.biggest_win),
        best_odds_won: parseFloat(s.best_odds_won),
        parlay_wins: parseInt(s.parlay_wins),
        current_streak: streak,
      },
      by_competition: byCompetitionRes.rows.map(r => ({
        competition_name: r.competition_name,
        wins: parseInt(r.wins),
        losses: parseInt(r.losses),
        total: parseInt(r.total),
        win_rate: Math.round((r.wins / r.total) * 100),
      })),
      monthly: monthlyRes.rows,
    });
  } catch (err) { next(err); }
});

// GET /api/users/me/achievements
router.get('/me/achievements', authenticate, async (req, res, next) => {
  try {
    const streak = await getStreak(req.user.id);
    const result = await pool.query(
      `SELECT achievement_key, unlocked_at FROM user_achievements WHERE user_id = $1 ORDER BY unlocked_at ASC`,
      [req.user.id]
    );
    res.json({ achievements: result.rows, streak });
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
  const firebaseUid = req.user.firebase_uid;
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE bets SET status = 'cancelled' WHERE user_id = $1 AND status = 'pending'`, [req.user.id]);
    await client.query(`DELETE FROM league_members WHERE user_id = $1`, [req.user.id]);
    await client.query(`DELETE FROM quiz_attempts WHERE user_id = $1`, [req.user.id]);
    await client.query(`DELETE FROM mini_game_attempts WHERE user_id = $1`, [req.user.id]);
    await client.query(`DELETE FROM point_transactions WHERE user_id = $1`, [req.user.id]);
    await client.query(`DELETE FROM users WHERE id = $1`, [req.user.id]);
    await client.query('COMMIT');
    if (process.env.STUB_MODE !== 'true') {
      try {
        await admin.auth().deleteUser(firebaseUid);
      } catch (fbErr) {
        console.error('[deleteAccount] Firebase deletion failed (DB already committed):', fbErr.message);
      }
    }
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

// GET /api/users/me/following
router.get('/me/following', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.avatar_url, u.points_balance, u.total_bets, u.total_wins
       FROM user_follows uf
       JOIN users u ON u.id = uf.followed_id
       WHERE uf.follower_id = $1
       ORDER BY uf.created_at DESC`,
      [req.user.id]
    );
    res.json({ following: result.rows });
  } catch (err) { next(err); }
});

// POST /api/users/:username/follow
router.post('/:username/follow', authenticate, async (req, res, next) => {
  try {
    const targetRes = await pool.query(`SELECT id FROM users WHERE username = $1`, [req.params.username]);
    if (!targetRes.rows[0]) return res.status(404).json({ error: 'User not found' });
    const targetId = targetRes.rows[0].id;
    if (targetId === req.user.id) return res.status(400).json({ error: 'Cannot follow yourself' });
    await pool.query(
      `INSERT INTO user_follows (follower_id, followed_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.user.id, targetId]
    );
    res.json({ following: true });
  } catch (err) { next(err); }
});

// DELETE /api/users/:username/follow
router.delete('/:username/follow', authenticate, async (req, res, next) => {
  try {
    const targetRes = await pool.query(`SELECT id FROM users WHERE username = $1`, [req.params.username]);
    if (!targetRes.rows[0]) return res.status(404).json({ error: 'User not found' });
    await pool.query(
      `DELETE FROM user_follows WHERE follower_id = $1 AND followed_id = $2`,
      [req.user.id, targetRes.rows[0].id]
    );
    res.json({ following: false });
  } catch (err) { next(err); }
});

// GET /api/users/:username — public profile (with achievements + streak)
router.get('/:username', optionalAuthenticate, async (req, res, next) => {
  try {
    const userRes = await pool.query(
      `SELECT id, username, avatar_url, points_balance, total_bets, total_wins, created_at
       FROM users WHERE username = $1`,
      [req.params.username]
    );
    if (!userRes.rows[0]) return res.status(404).json({ error: 'User not found' });
    const user = userRes.rows[0];

    const [rankRes, leaguesRes, achievementsRes, followersRes, followingRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) + 1 AS rank FROM users WHERE points_balance > $1`, [user.points_balance]),
      pool.query(`SELECT COUNT(*) AS league_count FROM league_members WHERE user_id = $1 AND is_active = true`, [user.id]),
      pool.query(`SELECT achievement_key, unlocked_at FROM user_achievements WHERE user_id = $1 ORDER BY unlocked_at ASC`, [user.id]),
      pool.query(`SELECT COUNT(*) AS count FROM user_follows WHERE followed_id = $1`, [user.id]),
      pool.query(`SELECT COUNT(*) AS count FROM user_follows WHERE follower_id = $1`, [user.id]),
    ]);

    let is_following = false;
    if (req.user && req.user.id !== user.id) {
      const followCheck = await pool.query(
        `SELECT 1 FROM user_follows WHERE follower_id = $1 AND followed_id = $2`,
        [req.user.id, user.id]
      );
      is_following = followCheck.rows.length > 0;
    }

    const streak = await getStreak(user.id);

    res.json({
      user: {
        ...user,
        rank: parseInt(rankRes.rows[0].rank),
        league_count: parseInt(leaguesRes.rows[0].league_count),
        achievements: achievementsRes.rows,
        streak,
        followers_count: parseInt(followersRes.rows[0].count),
        following_count: parseInt(followingRes.rows[0].count),
        is_following,
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
