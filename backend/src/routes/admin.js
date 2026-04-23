/**
 * routes/admin.js – routes ניהול (מוגן)
 *
 * כל ה-routes דורשים middleware requireAdmin.
 * Endpoints מרכזיים:
 *   GET  /admin/me           – בדיקת סטטוס מנהל
 *   GET  /admin/stats        – KPIs: משתמשים, הימורים, הכנסה
 *   GET  /admin/users        – ניהול משתמשים (חיפוש, התאמת נקודות, מחיקה)
 *   GET  /admin/games        – ניהול משחקים (featured, lock, odds)
 *   GET  /admin/leagues      – ניהול ליגות (pause, stop)
 *   POST /admin/notify       – שליחת התראה לכל/מישהו
 *   GET  /admin/log          – audit log של פעולות מנהל
 *   POST /ops/generate-minigames – ייצור ידני של חידות
 */
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { logAdminAction } = require('../services/adminLogService');

// Seed admin_users table from ADMIN_EMAILS env var on startup
;(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        email VARCHAR(200) PRIMARY KEY,
        added_by VARCHAR(200),
        added_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    const emails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map(e => e.replace(/['"]/g, '').trim().toLowerCase())
      .filter(Boolean);
    for (const email of emails) {
      await pool.query(
        'INSERT INTO admin_users (email, added_by) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING',
        [email, 'system']
      );
    }
  } catch (e) {
    console.error('admin_users seed failed:', e.message);
  }
})();

router.use(authenticate, requireAdmin);

// GET /api/admin/me
router.get('/me', (req, res) => {
  res.json({ is_admin: true, email: req.user.email });
});

// GET /api/admin/admins
router.get('/admins', async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT email, added_by, added_at FROM admin_users ORDER BY added_at ASC'
    );
    res.json({ admins: result.rows });
  } catch (err) { next(err); }
});

// POST /api/admin/admins
router.post('/admins', async (req, res, next) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });
  const normalizedEmail = email.toLowerCase().trim();
  try {
    await pool.query(
      'INSERT INTO admin_users (email, added_by) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING',
      [normalizedEmail, req.user.email]
    );
    await logAdminAction(req.user.email, 'add_admin', 'admin_user', normalizedEmail, { email: normalizedEmail });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// DELETE /api/admin/admins/:email
router.delete('/admins/:email', async (req, res, next) => {
  const email = decodeURIComponent(req.params.email).toLowerCase().trim();
  const envAdmins = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.replace(/['"]/g, '').trim().toLowerCase())
    .filter(Boolean);
  if (envAdmins.includes(email)) {
    return res.status(400).json({ error: 'לא ניתן להסיר מנהל ראשי (מוגדר בסביבה)' });
  }
  try {
    await pool.query('DELETE FROM admin_users WHERE email = $1', [email]);
    await logAdminAction(req.user.email, 'remove_admin', 'admin_user', email, { email });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

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
  
  // Filter out anonymized users (those starting with deleted_)
  let where = `WHERE username NOT LIKE 'deleted_%'`;
  
  if (search) {
    where += ` AND (username ILIKE $3 OR email ILIKE $3)`;
    params.push(`%${search}%`);
  }
  
  try {
    const result = await pool.query(
      `SELECT id, firebase_uid, username, display_name, email, points_balance, total_bets, total_wins, created_at,
              phone_number, phone_verified, wa_opt_in
       FROM users ${where} ORDER BY created_at DESC LIMIT $1 OFFSET $2`, params
    );
    res.json({ users: result.rows });
  } catch (err) { next(err); }
});

// PATCH /api/admin/users/:id — edit username / display_name
router.patch('/users/:id', async (req, res, next) => {
  const { username, display_name } = req.body;
  const sets = [], params = [];
  if (username?.trim()) { params.push(username.trim()); sets.push(`username = $${params.length}`); }
  if (display_name !== undefined) { params.push(display_name?.trim() || null); sets.push(`display_name = $${params.length}`); }
  if (!sets.length) return res.status(400).json({ error: 'At least one field required' });
  params.push(req.params.id);
  try {
    const r = await pool.query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING id, username, display_name, email`,
      params
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'User not found' });
    await logAdminAction(req.user.email, 'edit_user', 'user', req.params.id, { username, display_name });
    res.json({ user: r.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'שם המשתמש כבר תפוס' });
    next(err);
  }
});

// DELETE /api/admin/users/:id — soft-delete a user
router.delete('/users/:id', async (req, res, next) => {
  const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userRes = await client.query(`SELECT username, email, firebase_uid FROM users WHERE id = $1`, [req.params.id]);
    if (!userRes.rows[0]) return res.status(404).json({ error: 'User not found' });
    if (ADMIN_EMAILS.includes(userRes.rows[0].email)) {
      return res.status(403).json({ error: 'לא ניתן למחוק חשבון מנהל' });
    }
    // Deactivate league memberships
    await client.query(`UPDATE league_members SET is_active = false WHERE user_id = $1`, [req.params.id]);
    // Cancel pending bets
    await client.query(`UPDATE bets SET status = 'cancelled' WHERE user_id = $1 AND status = 'pending'`, [req.params.id]);
    // Anonymize user (to release username/email/uid while keeping DB integrity for old bets/stats)
    const anonSuffix = req.params.id.slice(0, 8);
    const firebaseUid = userRes.rows[0].firebase_uid;
    
    await client.query(
      `UPDATE users SET username = $1, email = $2, display_name = NULL, firebase_uid = $1, phone_number = NULL
       WHERE id = $3`,
      [`deleted_${anonSuffix}`, `deleted_${anonSuffix}@deleted.invalid`, req.params.id]
    );

    // Try to delete from Firebase so they can't log in anymore
    try {
      const firebaseAdmin = require('../config/firebase');
      if (firebaseUid && !firebaseUid.startsWith('deleted_')) {
        await firebaseAdmin.auth().deleteUser(firebaseUid);
      }
    } catch (fbErr) {
      console.warn(`Could not delete user ${req.params.id} from Firebase:`, fbErr.message);
    }

    await client.query('COMMIT');
    await logAdminAction(req.user.email, 'delete_user', 'user', req.params.id, { username: userRes.rows[0].username });
    res.json({ message: 'User deleted' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

// DELETE /api/admin/users/:id/phone — unlink phone number from user
router.delete('/users/:id/phone', async (req, res, next) => {
  try {
    const r = await pool.query(
      `UPDATE users SET phone_number = NULL, phone_verified = false WHERE id = $1 RETURNING id, username`,
      [req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'User not found' });
    await logAdminAction(req.user.email, 'unlink_phone', 'user', req.params.id, {});
    res.json({ ok: true });
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
      `SELECT b.*, u.username, g.home_team, g.away_team, 
              bq.question_text, bq.type as bet_type,
              l.name as league_name, l.bet_mode as league_bet_mode, l.access_type as league_access_type
       FROM bets b
       JOIN users u ON u.id = b.user_id 
       JOIN games g ON g.id = b.game_id
       JOIN bet_questions bq ON bq.id = b.bet_question_id
       LEFT JOIN leagues l ON l.id = b.league_id
       ${where} ORDER BY b.placed_at DESC LIMIT $1 OFFSET $2`, params
    );

    res.json({ bets: result.rows });
  } catch (err) { next(err); }
});

// GET /api/admin/games
router.get('/games', async (req, res, next) => {
  const limit = Math.min(parseInt(req.query.limit) || 200, 500);
  const offset = parseInt(req.query.offset) || 0;

  // Default window: 7 days ago → 60 days from now.
  // Pass from=all to skip the filter entirely.
  const skipFilter = req.query.from === 'all';
  const fromDate = skipFilter ? null : (req.query.from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const toDate   = skipFilter ? null : (req.query.to   || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

  try {
    const conditions = [];
    const params = [limit, offset];
    if (fromDate) { params.push(fromDate); conditions.push(`g.start_time >= $${params.length}`); }
    if (toDate)   { params.push(toDate + 'T23:59:59');   conditions.push(`g.start_time <= $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT g.*, c.name AS competition_name,
              (SELECT COUNT(*) FROM bets WHERE game_id = g.id) AS total_bets,
              (SELECT BOOL_AND(is_locked) FROM bet_questions WHERE game_id = g.id) AS is_fully_locked,
              (SELECT COUNT(*) FROM bet_questions WHERE game_id = g.id) AS question_count,
              (SELECT bq.odds_source FROM bet_questions bq WHERE bq.game_id = g.id AND bq.type = 'match_winner' LIMIT 1) AS odds_source,
              (SELECT bq.outcomes FROM bet_questions bq WHERE bq.game_id = g.id AND bq.type = 'match_winner' LIMIT 1) AS match_winner_outcomes
       FROM games g LEFT JOIN competitions c ON c.id = g.competition_id
       ${where}
       ORDER BY g.start_time ASC LIMIT $1 OFFSET $2`,
      params
    );
    res.json({ games: result.rows });
  } catch (err) { next(err); }
});

// PATCH /api/admin/games/:id/odds — manually override match_winner odds
router.patch('/games/:id/odds', async (req, res, next) => {
  const { home_odds, draw_odds, away_odds } = req.body;
  if (!home_odds || !draw_odds || !away_odds) return res.status(400).json({ error: 'home_odds, draw_odds, away_odds required' });
  try {
    const gRes = await pool.query('SELECT home_team, away_team FROM games WHERE id = $1', [req.params.id]);
    if (!gRes.rows[0]) return res.status(404).json({ error: 'Game not found' });
    const { home_team, away_team } = gRes.rows[0];
    const outcomes = [
      { label: home_team, odds: parseFloat(home_odds) },
      { label: 'Draw',    odds: parseFloat(draw_odds) },
      { label: away_team, odds: parseFloat(away_odds) },
    ];
    await pool.query(
      `UPDATE bet_questions SET outcomes = $1::jsonb, odds_source = 'admin'
       WHERE game_id = $2 AND type = 'match_winner'`,
      [JSON.stringify(outcomes), req.params.id]
    );
    await logAdminAction(req.user.email, 'set_game_odds', 'game', req.params.id, { home_odds, draw_odds, away_odds });
    res.json({ message: 'Odds updated' });
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
              (SELECT COUNT(*) FROM league_members lm WHERE lm.league_id = l.id AND lm.is_active = true) AS member_count,
              wg.wa_group_id, wg.invite_link AS wa_invite_link, wg.is_active AS wa_group_active
       FROM leagues l
       JOIN users u ON u.id = l.creator_id
       LEFT JOIN wa_groups wg ON wg.league_id = l.id AND wg.is_active = true
       ORDER BY l.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json({ leagues: result.rows });
  } catch (err) { next(err); }
});

// DELETE /api/admin/leagues/:id/wa-group — remove WA group link
router.delete('/leagues/:id/wa-group', async (req, res, next) => {
  try {
    await pool.query(`UPDATE wa_groups SET is_active = false WHERE league_id = $1`, [req.params.id]);
    await pool.query(`UPDATE leagues SET wa_enabled = false WHERE id = $1`, [req.params.id]);
    await logAdminAction(req.user.email, 'remove_wa_group', 'league', req.params.id, null);
    res.json({ message: 'WA group removed' });
  } catch (err) { next(err); }
});

// PATCH /api/admin/leagues/:id/wa-group — set invite link manually
router.patch('/leagues/:id/wa-group', async (req, res, next) => {
  const { invite_link } = req.body;
  if (!invite_link) return res.status(400).json({ error: 'invite_link required' });
  try {
    await pool.query(
      `UPDATE wa_groups SET invite_link = $1 WHERE league_id = $2 AND is_active = true`,
      [invite_link, req.params.id]
    );
    await logAdminAction(req.user.email, 'set_wa_invite_link', 'league', req.params.id, { invite_link });
    res.json({ message: 'Invite link updated' });
  } catch (err) { next(err); }
});

// POST /api/admin/leagues/:id/pause
router.post('/leagues/:id/pause', async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE leagues SET status = 'paused' WHERE id = $1 AND status = 'active' RETURNING id, name`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'League not found or not active' });
    await logAdminAction(req.user.email, 'pause_league', 'league', req.params.id, { name: result.rows[0].name });
    res.json({ message: 'League paused', league: result.rows[0] });
  } catch (err) { next(err); }
});

// POST /api/admin/leagues/:id/stop — terminate league with optional prize distribution
router.post('/leagues/:id/stop', async (req, res, next) => {
  const { distribute_prizes, custom_pool_total, custom_distribution } = req.body; // boolean
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const leagueRes = await client.query(`SELECT * FROM leagues WHERE id = $1`, [req.params.id]);
    const league = leagueRes.rows[0];
    if (!league) return res.status(404).json({ error: 'League not found' });
    if (league.status === 'finished') return res.status(400).json({ error: 'League already finished' });

    const poolAmount = custom_pool_total !== undefined ? parseFloat(custom_pool_total) : parseFloat(league.pool_total);
    const distData = custom_distribution ? custom_distribution : league.distribution;

    if (distribute_prizes && poolAmount > 0 && distData) {
      const membersRes = await client.query(
        `SELECT lm.user_id, COALESCE(SUM(b.payout), 0) AS total_payout
         FROM league_members lm
         LEFT JOIN bets b ON b.user_id = lm.user_id AND b.league_id = lm.league_id AND b.status = 'won'
         WHERE lm.league_id = $1 AND lm.is_active = true
         GROUP BY lm.user_id
         ORDER BY total_payout DESC`,
        [league.id]
      );
      const members = membersRes.rows;
      const distribution = typeof distData === 'string' ? JSON.parse(distData) : distData;
      
      for (let i = 0; i < members.length && i < distribution.length; i++) {
        const pct = parseFloat(distribution[i]) / 100;
        const prize = Math.floor(poolAmount * pct);
        if (prize <= 0) continue;
        await client.query(
          `UPDATE users SET points_balance = points_balance + $1 WHERE id = $2`,
          [prize, members[i].user_id]
        );
        await client.query(
          `INSERT INTO point_transactions (user_id, amount, type, reference_id, description)
           VALUES ($1,$2,'league_prize',$3,$4)`,
          [members[i].user_id, prize, league.id, `Prize: ${league.name} (place ${i + 1})`]
        );
      }
    }

    await client.query(
      `UPDATE leagues SET status = 'finished' WHERE id = $1`,
      [league.id]
    );
    await client.query('COMMIT');
    await logAdminAction(req.user.email, 'stop_league', 'league', league.id, { name: league.name, distribute_prizes: !!distribute_prizes, pool: poolAmount });
    res.json({ message: distribute_prizes ? 'ליגה נסגרה ופרסים חולקו' : 'ליגה נסגרה ללא חלוקת פרסים' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
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
  const { type, title, body, target, send_to_dms = true, send_to_group = false } = req.body;
  if (!type || !title) return res.status(400).json({ error: 'type and title required' });
  if (!['special_offer', 'admin_message'].includes(type)) {
    return res.status(400).json({ error: 'type must be special_offer or admin_message' });
  }
  const { createNotification } = require('../services/notificationService');
  const { sendDM, sendGroup: sendMessageToGroup } = require('../services/whatsappBotService');
  
  try {
    let users = [];
    let leagueGroupIds = [];

    if (!target || target === 'all') {
      const result = await pool.query(`SELECT id, phone_number, phone_verified, wa_opt_in FROM users`);
      users = result.rows;
    } else if (typeof target === 'object' && (target.league_id || target.league_ids)) {
      const ids = target.league_ids ?? [target.league_id];
      
      // Fetch users
      const userRes = await pool.query(
        `SELECT DISTINCT u.id, u.phone_number, u.phone_verified, u.wa_opt_in
         FROM users u
         JOIN league_members lm ON lm.user_id = u.id
         WHERE lm.league_id = ANY($1) AND lm.is_active = true`,
        [ids]
      );
      users = userRes.rows;

      // Fetch group IDs if needed
      if (send_to_group) {
        const groupRes = await pool.query(`SELECT wa_group_id FROM wa_groups WHERE league_id = ANY($1) AND is_active = true`, [ids]);
        leagueGroupIds = groupRes.rows.map(r => r.wa_group_id);
      }
    } else {
      const targetList = Array.isArray(target) ? target : [target];
      const result = await pool.query(
        `SELECT id, phone_number, phone_verified, wa_opt_in FROM users WHERE username = ANY($1)`,
        [targetList]
      );
      users = result.rows;
    }

    const waText = `הודעה מצוות KickOff 📣:\n\n*${title}*\n${body || ''}`;

    // Send to Internal Notifications ALWAYS
    for (const u of users) {
      await createNotification(u.id, { type, title, body });
      
      // Send to DMs ONLY IF requested
      if (send_to_dms && u.phone_number && u.phone_verified && u.wa_opt_in) {
        sendDM(u.phone_number, waText).catch(e => console.error(`[AdminNotify] DM error for ${u.id}:`, e.message));
      }
    }

    // Send to Groups
    if (send_to_group && leagueGroupIds.length > 0) {
      for (const groupId of leagueGroupIds) {
        sendMessageToGroup(groupId, waText).catch(e => console.error(`[AdminNotify] Group error for ${groupId}:`, e.message));
      }
    }

    res.json({ message: 'Notifications sent', sent_to: users.length, groups_sent: leagueGroupIds.length });
  } catch (err) { 
    console.error(`[AdminNotify] Global error:`, err.message);
    next(err); 
  }
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

// GET /api/admin/minigames/drafts/:type
router.get('/minigames/drafts/:type', async (req, res, next) => {
  try {
    const { generateMiniGameDraft } = require('../jobs/generateMiniGames');
    const draft = await generateMiniGameDraft(req.params.type, req.query);
    res.json({ draft });
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

// GET /api/admin/minigames/queue
router.get('/minigames/queue', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, game_type, play_date, puzzle_data, solution, answer_he 
       FROM daily_mini_games 
       ORDER BY play_date ASC, game_type ASC`
    );
    res.json({ queue: result.rows });
  } catch (err) { next(err); }
});

// PATCH /api/admin/minigames/queue/:id
router.patch('/minigames/queue/:id', async (req, res, next) => {
  const { play_date } = req.body;
  if (!play_date) return res.status(400).json({ error: 'play_date required' });
  try {
    const result = await pool.query(
      `UPDATE daily_mini_games SET play_date = $1 WHERE id = $2 RETURNING *`,
      [play_date, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ game: result.rows[0] });
  } catch (err) { next(err); }
});

// DELETE /api/admin/minigames/queue/:id
router.delete('/minigames/queue/:id', async (req, res, next) => {
  try {
    const result = await pool.query(`DELETE FROM daily_mini_games WHERE id = $1 RETURNING id`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
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

// POST /api/admin/games/:id/lock — lock all bet questions for a game
router.post('/games/:id/lock', async (req, res, next) => {
  try {
    await pool.query(`UPDATE bet_questions SET is_locked = true WHERE game_id = $1`, [req.params.id]);
    await logAdminAction(req.user.email, 'lock_game', 'game', req.params.id, null);
    res.json({ message: 'All questions locked' });
  } catch (err) { next(err); }
});

// DELETE /api/admin/games/:id/lock — unlock all bet questions for a game
router.delete('/games/:id/lock', async (req, res, next) => {
  try {
    await pool.query(`UPDATE bet_questions SET is_locked = false WHERE game_id = $1`, [req.params.id]);
    await logAdminAction(req.user.email, 'unlock_game', 'game', req.params.id, null);
    res.json({ message: 'All questions unlocked' });
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

// ── Team name translations ────────────────────────────────────────────────────

// GET /api/admin/team-translations — pending only
router.get('/team-translations', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT name_en, name_he, status, created_at FROM team_name_translations WHERE status = 'pending' ORDER BY created_at DESC`
    );
    res.json({ translations: result.rows });
  } catch (err) { next(err); }
});

// PUT /api/admin/team-translations/:name_en — edit Hebrew name + approve
router.put('/team-translations/:name_en', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { name_he } = req.body;
    const { name_en } = req.params;
    await pool.query(
      `UPDATE team_name_translations SET name_he = $1, status = 'approved' WHERE name_en = $2`,
      [name_he, name_en]
    );
    await logAdminAction(req.user.email, 'approve_team_translation', 'team_translation', name_en, { name_he });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// DELETE /api/admin/team-translations/:name_en — dismiss (remove pending)
router.delete('/team-translations/:name_en', authenticate, requireAdmin, async (req, res, next) => {
  try {
    await pool.query(`DELETE FROM team_name_translations WHERE name_en = $1`, [req.params.name_en]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET /api/admin/odds-debug — check odds cache status
router.get('/odds-debug', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { fetchAllOdds } = require('../services/oddsApi');
    const { setOddsCache } = require('../services/sportsApi');
    const hasKey = !!process.env.THE_ODDS_API_KEY;
    const cache = await fetchAllOdds();
    setOddsCache(cache);
    const keys = Object.keys(cache);
    res.json({
      has_api_key: hasKey,
      total_matches: keys.length,
      sample_keys: keys.slice(0, 20),
    });
  } catch (err) { next(err); }
});

// POST /api/admin/regenerate-bet-questions — re-generate question_text + outcomes in Hebrew
// Only touches questions for scheduled games that have zero bets
router.post('/regenerate-bet-questions', authenticate, requireAdmin, async (req, res, next) => {
  const { fetchAllOdds } = require('../services/oddsApi');
  const { buildBetQuestions, setOddsCache } = require('../services/sportsApi');
  // Reload fresh odds before regenerating so new bets get real odds_source
  const freshOdds = await fetchAllOdds();
  setOddsCache(freshOdds);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Find bet_questions with no bets, for scheduled games
    const toRegen = await client.query(`
      SELECT bq.id, bq.type, g.home_team, g.away_team, g.espn_odds
      FROM bet_questions bq
      JOIN games g ON g.id = bq.game_id
      WHERE g.status = 'scheduled'
        AND NOT EXISTS (SELECT 1 FROM bets b WHERE b.bet_question_id = bq.id)
    `);
    let count = 0;
    for (const row of toRegen.rows) {
      const mockGame = { home_team: row.home_team, away_team: row.away_team, espn_odds: row.espn_odds };
      const questions = buildBetQuestions(mockGame);
      const q = questions.find((x) => x.type === row.type);
      if (!q) continue;
      await client.query(
        `UPDATE bet_questions SET question_text = $1, outcomes = $2, odds_source = $3 WHERE id = $4`,
        [q.question_text, JSON.stringify(q.outcomes), q.odds_source || 'default', row.id]
      );
      count++;
    }
    await client.query('COMMIT');
    await logAdminAction(req.user.email, 'regenerate_bet_questions', null, null, { count });
    res.json({ ok: true, updated: count });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

// POST /api/admin/run-settlement — manually trigger bet settlement (for missed games)
router.post('/run-settlement', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { settleBets } = require('../jobs/settleBets');
    // Count pending bets before to report how many were settled
    const before = await pool.query(`SELECT COUNT(*) FROM bets WHERE status = 'pending'`);
    const gamesBefore = await pool.query(
      `SELECT COUNT(DISTINCT g.id) FROM games g JOIN bets b ON b.game_id = g.id WHERE g.status = 'finished' AND b.status = 'pending'`
    );
    await settleBets();
    const after = await pool.query(`SELECT COUNT(*) FROM bets WHERE status = 'pending'`);
    const settled = parseInt(before.rows[0].count) - parseInt(after.rows[0].count);
    await logAdminAction(req.user.email, 'run_settlement', null, null, { settled });
    res.json({ ok: true, settled, games: parseInt(gamesBefore.rows[0].count) });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════
// AI ADVISOR ADMIN ROUTES
// ═══════════════════════════════════════════════════════════════
const advisorMetrics = require('../services/advisorMetrics');
const { encrypt, makePreview } = require('../lib/crypto');
const { invalidateCache, getSecret } = require('../lib/secrets');
const { chatStream } = require('../services/advisorService');

// GET /api/admin/advisor/stats
router.get('/advisor/stats', async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const [overview, daily] = await Promise.all([advisorMetrics.getStats(days), advisorMetrics.getDaily(days)]);
    res.json({ overview, daily });
  } catch (err) { next(err); }
});

// GET /api/admin/advisor/stats/tools
router.get('/advisor/stats/tools', async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 30;
    res.json(await advisorMetrics.getToolBreakdown(days));
  } catch (err) { next(err); }
});

// GET /api/admin/advisor/stats/users
router.get('/advisor/stats/users', async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 30;
    res.json(await advisorMetrics.getTopUsers(days));
  } catch (err) { next(err); }
});

// GET /api/admin/advisor/events
router.get('/advisor/events', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;
    res.json(await advisorMetrics.getEvents(limit, offset));
  } catch (err) { next(err); }
});

// GET /api/admin/advisor/config
router.get('/advisor/config', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT key, value, updated_at, updated_by FROM advisor_config ORDER BY key');
    res.json(Object.fromEntries(result.rows.map(r => [r.key, { value: r.value, updated_at: r.updated_at, updated_by: r.updated_by }])));
  } catch (err) { next(err); }
});

// PATCH /api/admin/advisor/config
router.patch('/advisor/config', async (req, res, next) => {
  const allowed = ['model', 'daily_limit', 'temperature', 'max_tokens', 'system_prompt'];
  const updates = Object.entries(req.body).filter(([k]) => allowed.includes(k));
  if (!updates.length) return res.status(400).json({ error: 'No valid config keys' });
  try {
    for (const [key, value] of updates) {
      await pool.query(
        `INSERT INTO advisor_config (key, value, updated_at, updated_by) VALUES ($1, $2, NOW(), $3)
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW(), updated_by = $3`,
        [key, String(value), req.user.email]
      );
    }
    await logAdminAction(req.user.email, 'update_advisor_config', 'advisor_config', null, req.body);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET /api/admin/advisor/secrets
router.get('/advisor/secrets', async (req, res, next) => {
  try {
    const dbRes = await pool.query('SELECT key, preview, updated_at, updated_by FROM encrypted_secrets ORDER BY key');
    const ENV_KEYS = ['GROQ_API_KEY', 'THE_ODDS_API_KEY', 'FIREBASE_API_KEY', 'FIREBASE_PRIVATE_KEY', 'FIREBASE_CLIENT_EMAIL', 'WHATSAPP_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'LINKEDIN_ACCESS_TOKEN', 'INSTAGRAM_ACCESS_TOKEN', 'TIKTOK_ACCESS_TOKEN', 'SERPER_API_KEY'];
    const dbKeys = new Set(dbRes.rows.map(r => r.key));
    const all = ENV_KEYS.map(key => {
      if (dbKeys.has(key)) return dbRes.rows.find(r => r.key === key);
      const envVal = process.env[key];
      return { key, preview: envVal ? makePreview(envVal) : null, source: 'env', updated_at: null };
    });
    res.json(all);
  } catch (err) { next(err); }
});

// PUT /api/admin/advisor/secrets/:key
router.put('/advisor/secrets/:key', async (req, res, next) => {
  const { key } = req.params;
  const { value } = req.body;
  if (!value || typeof value !== 'string') return res.status(400).json({ error: 'value is required' });
  const ALLOWED_KEYS = ['GROQ_API_KEY', 'THE_ODDS_API_KEY', 'FIREBASE_API_KEY', 'FIREBASE_PRIVATE_KEY', 'FIREBASE_CLIENT_EMAIL', 'WHATSAPP_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'LINKEDIN_ACCESS_TOKEN', 'INSTAGRAM_ACCESS_TOKEN', 'TIKTOK_ACCESS_TOKEN', 'SERPER_API_KEY'];
  if (!ALLOWED_KEYS.includes(key)) return res.status(400).json({ error: 'Unknown secret key' });
  try {
    const { value_encrypted, iv, auth_tag } = encrypt(value);
    const preview = makePreview(value);
    await pool.query(
      `INSERT INTO encrypted_secrets (key, value_encrypted, iv, auth_tag, preview, updated_at, updated_by)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6)
       ON CONFLICT (key) DO UPDATE SET value_encrypted=$2, iv=$3, auth_tag=$4, preview=$5, updated_at=NOW(), updated_by=$6`,
      [key, value_encrypted, iv, auth_tag, preview, req.user.email]
    );
    invalidateCache(key);
    await logAdminAction(req.user.email, 'update_secret', 'encrypted_secrets', key, { key, preview });
    res.json({ ok: true, preview });
  } catch (err) { next(err); }
});

// POST /api/admin/advisor/secrets/:key/test
router.post('/advisor/secrets/:key/test', async (req, res, next) => {
  const { key } = req.params;
  try {
    const value = await getSecret(key);
    if (!value) return res.json({ ok: false, message: 'מפתח לא מוגדר' });
    if (key === 'GROQ_API_KEY') {
      const Groq = require('groq-sdk');
      const groq = new Groq({ apiKey: value });
      await groq.chat.completions.create({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: 'ping' }], max_tokens: 5 });
      return res.json({ ok: true, message: 'GROQ_API_KEY תקין' });
    }
    if (key === 'THE_ODDS_API_KEY') {
      const axios = require('axios');
      const r = await axios.get(`https://api.the-odds-api.com/v4/sports?apiKey=${value}`, { timeout: 8000 });
      return res.json({ ok: r.status === 200, message: r.status === 200 ? 'THE_ODDS_API_KEY תקין' : 'שגיאה' });
    }
    return res.json({ ok: true, message: `${key} — קיים` });
  } catch (err) {
    res.json({ ok: false, message: err.message });
  }
});

// GET /api/admin/advisor/playground (SSE — bypasses rate limit)
router.get('/advisor/playground', async (req, res) => {
  let messages;
  try { messages = JSON.parse(req.query.messages || '[]'); } catch { return res.status(400).json({ error: 'Invalid messages JSON' }); }
  if (!Array.isArray(messages) || messages.length === 0) return res.status(400).json({ error: 'messages required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  try {
    await chatStream(null, req.user.id, messages, send, true);
  } catch (e) {
    send('error', { message: e.message });
  } finally {
    res.end();
  }
});


// ── Support Inquiries ─────────────────────────────────────────────────────────

// GET /api/admin/support-inquiries
router.get('/support-inquiries', async (req, res, next) => {
  const { status } = req.query;
  const params = [];
  let where = '';
  if (status) {
    params.push(status);
    where = 'WHERE s.status = $1';
  }
  try {
    const result = await pool.query(
      `SELECT s.*, u.username, u.email, u.display_name, u.phone_number, u.phone_verified, u.wa_opt_in
       FROM support_inquiries s
       JOIN users u ON u.id = s.user_id
       ${where}
       ORDER BY s.created_at DESC`,
      params
    );
    res.json({ inquiries: result.rows });
  } catch (err) { next(err); }
});

// PATCH /api/admin/support-inquiries/:id/status
router.patch('/support-inquiries/:id/status', async (req, res, next) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status required' });
  try {
    const result = await pool.query(
      'UPDATE support_inquiries SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Inquiry not found' });
    res.json({ inquiry: result.rows[0] });
  } catch (err) { next(err); }
});

// POST /api/admin/support-inquiries/:id/reply
router.post('/support-inquiries/:id/reply', async (req, res, next) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Get Inquiry and User details
    const inqRes = await client.query(
      `SELECT s.*, u.id as user_id, u.phone_number, u.phone_verified, u.wa_opt_in 
       FROM support_inquiries s 
       JOIN users u ON u.id = s.user_id 
       WHERE s.id = $1`,
      [req.params.id]
    );
    const inquiry = inqRes.rows[0];
    if (!inquiry) return res.status(404).json({ error: 'Inquiry not found' });

    // 2. Update inquiry status and reply
    await client.query(
      'UPDATE support_inquiries SET status = $1, reply_message = $2, replied_at = NOW(), updated_at = NOW() WHERE id = $3',
      ['handled', message, req.params.id]
    );

    // 3. Create notification for user
    const { createNotification } = require('../services/notificationService');
    await createNotification(inquiry.user_id, {
      type: 'admin_message',
      title: `תשובה לפנייה מס׳ ${inquiry.inquiry_number}`,
      body: message,
      data: { inquiry_id: inquiry.id }
    });

    // 4. Send WhatsApp if opted in
    if (inquiry.phone_number && inquiry.phone_verified && inquiry.wa_opt_in) {
      const { sendDM } = require('../services/whatsappBotService');
      const waText = `שלום, התקבלה תשובה לפנייה מס׳ ${inquiry.inquiry_number} ששלחת למנהלי Kickoff:\n\n*תשובה:* ${message}`;
      sendDM(inquiry.phone_number, waText).catch(e => console.error('[SupportReply] WA error:', e.message));
    }

    await client.query('COMMIT');
    await logAdminAction(req.user.email, 'reply_support', 'support_inquiry', inquiry.id, { message });
    
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
module.exports.opsRouter = opsRouter;
