/**
 * routes/leagues.js – ניהול ליגות פרטיות
 *
 * Endpoints:
 *   POST /leagues              – יצירת ליגה חדשה
 *   POST /leagues/join         – הצטרפות לפי קוד הזמנה
 *   POST /leagues/:id/leave    – עזיבת ליגה
 *   GET  /leagues/my/list      – ליגות המשתמש
 *   GET  /leagues/:id          – פרטי ליגה + דירוג
 *   POST /leagues/:id/settle   – סגירת עונה + חלוקת פרסים (יוצר בלבד)
 *   GET  /leagues/:id/leaderboard – טבלת דירוג הליגה
 *
 * ליגה יכולה להיות בפורמט: pool (קופה משותפת), per_game (לפי משחק), tournament.
 */
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');

function generateInviteCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

// POST /api/leagues — create
router.post('/', authenticate, async (req, res, next) => {
  const {
    name, description, format, duration_type, access_type,
    min_bet, entry_fee, distribution, allowed_competitions, season_end_date,
    is_tournament, tournament_slug, stake_per_match, join_policy, auto_settle,
    penalty_per_missed_bet, max_members,
  } = req.body;

  if (!name || !format || !duration_type) {
    return res.status(400).json({ error: 'name, format, duration_type required' });
  }
  if (!['pool', 'per_game'].includes(format)) {
    return res.status(400).json({ error: 'format must be pool or per_game' });
  }

  // Only admins may create public leagues
  if (access_type === 'public') {
    const email = req.user?.email?.toLowerCase();
    const envAdmins = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.replace(/['"]/g, '').trim().toLowerCase()).filter(Boolean);
    let isAdmin = envAdmins.includes(email);
    if (!isAdmin) {
      try {
        const ar = await pool.query('SELECT 1 FROM admin_users WHERE email = $1', [email]);
        isAdmin = ar.rows.length > 0;
      } catch (_) {}
    }
    if (!isAdmin) return res.status(403).json({ error: 'ניתן ליצור ליגה ציבורית דרך לוח הניהול בלבד' });
  }

  // bet_mode is derived from format: pool → initial_balance, per_game → minimum_stake
  const derived_bet_mode = format === 'pool' ? 'initial_balance' : 'minimum_stake';

  if (distribution) {
    const total = distribution.reduce((sum, d) => sum + d.pct, 0);
    if (total !== 100) return res.status(400).json({ error: 'Distribution must sum to 100' });
    if (distribution.some(d => d.pct <= 0)) return res.status(400).json({ error: 'Distribution percentages must be greater than 0' });
    const places = distribution.map(d => d.place);
    if (new Set(places).size !== places.length) return res.status(400).json({ error: 'Duplicate places in distribution' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Tournament validation (optional competition)
    if (is_tournament && tournament_slug) {
      const compCheck = await client.query('SELECT id FROM competitions WHERE slug = $1', [tournament_slug]);
      if (!compCheck.rows[0]) return res.status(400).json({ error: 'Competition not found' });
    }

    const invite_code = generateInviteCode();
    const leagueRes = await client.query(
      `INSERT INTO leagues
         (name, description, creator_id, invite_code, format, duration_type, access_type,
          bet_mode, min_bet, entry_fee, distribution, allowed_competitions, season_end_date,
          is_tournament, tournament_slug, stake_per_match, join_policy, auto_settle,
          penalty_per_missed_bet, max_members)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *`,
      [
        name, description || null, req.user.id, invite_code, format,
        duration_type, access_type || 'invite',
        derived_bet_mode,
        min_bet || (format === 'per_game' ? 10 : 0), entry_fee || 0,
        distribution ? JSON.stringify(distribution) : null,
        allowed_competitions ? JSON.stringify(allowed_competitions) : null,
        season_end_date || null,
        is_tournament ? true : false,
        tournament_slug || null,
        stake_per_match || 0,
        join_policy || 'anytime',
        auto_settle || false,
        (is_tournament || format === 'pool') ? 0 : (penalty_per_missed_bet || 0),
        max_members || null,
      ]
    );
    const league = leagueRes.rows[0];

    // Deduct entry fee from creator and add to pool (only if they actually join, i.e., non-public)
    if (entry_fee > 0 && access_type !== 'public') {
      const balRes = await client.query(
        `UPDATE users SET points_balance = points_balance - $1
         WHERE id = $2 AND points_balance >= $1 RETURNING points_balance`,
        [entry_fee, req.user.id]
      );
      if (!balRes.rows[0]) throw Object.assign(new Error('Insufficient points for entry fee'), { status: 400 });
      await client.query(`UPDATE leagues SET pool_total = pool_total + $1 WHERE id = $2`, [entry_fee, league.id]);
      await client.query(
        `INSERT INTO point_transactions (user_id, amount, type, reference_id, description)
         VALUES ($1,$2,'league_entry',$3,$4)`,
        [req.user.id, -entry_fee, league.id, `Entry fee: ${name}`]
      );
    }

    // Public leagues created by admin start empty (no auto-join for creator)
    if (league.access_type !== 'public') {
      await client.query(`INSERT INTO league_members (league_id, user_id) VALUES ($1,$2)`, [league.id, req.user.id]);
    }
    await client.query('COMMIT');
    res.status(201).json({ league });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

// POST /api/leagues/join
router.post('/join', authenticate, async (req, res, next) => {
  const { invite_code } = req.body;
  if (!invite_code) return res.status(400).json({ error: 'invite_code required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const leagueRes = await client.query(`SELECT * FROM leagues WHERE invite_code = $1`, [invite_code.toUpperCase()]);
    const league = leagueRes.rows[0];
    if (!league) return res.status(404).json({ error: 'League not found' });
    if (league.status !== 'active') return res.status(400).json({ error: 'League is not active' });

    const memberCheck = await client.query(
      `SELECT id, is_active FROM league_members WHERE league_id = $1 AND user_id = $2`, [league.id, req.user.id]
    );
    if (memberCheck.rows[0]?.is_active) return res.status(409).json({ error: 'כבר חבר פעיל בליגה' });

    // Max members check
    if (league.max_members) {
      const countRes = await client.query(
        `SELECT COUNT(*) FROM league_members WHERE league_id = $1 AND is_active = true`, [league.id]
      );
      if (parseInt(countRes.rows[0].count) >= league.max_members) {
        return res.status(400).json({ error: 'הליגה מלאה — הגיעה למספר המקסימלי של חברים' });
      }
    }

    // Tournament join_policy enforcement
    if (league.is_tournament && league.join_policy === 'before_start' && league.tournament_slug) {
      const firstGame = await client.query(
        `SELECT MIN(g.start_time) AS first_start
         FROM games g JOIN competitions c ON c.id = g.competition_id
         WHERE c.slug = $1`,
        [league.tournament_slug]
      );
      const firstStart = firstGame.rows[0]?.first_start;
      if (firstStart && new Date(firstStart) <= new Date()) {
        return res.status(400).json({ error: 'הטורניר כבר התחיל. לא ניתן להצטרף.' });
      }
    }

    if (league.entry_fee > 0) {
      const balRes = await client.query(
        `UPDATE users SET points_balance = points_balance - $1
         WHERE id = $2 AND points_balance >= $1 RETURNING points_balance`,
        [league.entry_fee, req.user.id]
      );
      if (!balRes.rows[0]) throw Object.assign(new Error('Insufficient points for entry fee'), { status: 400 });
      await client.query(`UPDATE leagues SET pool_total = pool_total + $1 WHERE id = $2`, [league.entry_fee, league.id]);
      await client.query(
        `INSERT INTO point_transactions (user_id, amount, type, reference_id, description)
         VALUES ($1,$2,'league_entry',$3,$4)`,
        [req.user.id, -league.entry_fee, league.id, `Entry fee: ${league.name}`]
      );
    }

    if (memberCheck.rows[0]) {
      await client.query(`UPDATE league_members SET is_active = true WHERE league_id = $1 AND user_id = $2`, [league.id, req.user.id]);
    } else {
      await client.query(`INSERT INTO league_members (league_id, user_id) VALUES ($1,$2)`, [league.id, req.user.id]);
    }
    await client.query('COMMIT');
    res.json({ message: 'Joined', league });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

// POST /api/leagues/:id/leave
router.post('/:id/leave', authenticate, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const leagueRes = await client.query(`SELECT * FROM leagues WHERE id = $1`, [req.params.id]);
    const league = leagueRes.rows[0];
    if (!league) return res.status(404).json({ error: 'League not found' });
    if (league.status !== 'active') return res.status(400).json({ error: 'ליגה אינה פעילה' });

    const memberCheck = await client.query(
      `SELECT id FROM league_members WHERE league_id = $1 AND user_id = $2 AND is_active = true`,
      [league.id, req.user.id]
    );
    if (!memberCheck.rows[0]) return res.status(400).json({ error: 'אינך חבר בליגה' });

    await client.query(
      `UPDATE league_members SET is_active = false WHERE league_id = $1 AND user_id = $2`,
      [league.id, req.user.id]
    );

    // Transfer ownership if the creator is leaving
    if (league.creator_id === req.user.id) {
      const nextCreator = await client.query(
        `SELECT user_id FROM league_members WHERE league_id = $1 AND user_id != $2 AND is_active = true ORDER BY RANDOM() LIMIT 1`,
        [league.id, req.user.id]
      );
      if (nextCreator.rows[0]) {
        await client.query(
          `UPDATE leagues SET creator_id = $1 WHERE id = $2`,
          [nextCreator.rows[0].user_id, league.id]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'עזבת את הליגה. דמי הכניסה אינם מוחזרים.' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

// GET /api/leagues/invite/:code — preview league details by invite code
router.get('/invite/:code', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT l.id, l.name, l.description, l.format, l.entry_fee, l.pool_total, l.status, l.created_at,
              l.max_members, l.is_tournament, l.tournament_slug, l.stake_per_match, l.join_policy,
              (SELECT COUNT(*) FROM league_members lm WHERE lm.league_id = l.id AND lm.is_active = true) AS member_count,
              u.username AS creator_username, u.display_name AS creator_display_name,
              c.name AS tournament_name,
              EXISTS (SELECT 1 FROM league_members WHERE league_id = l.id AND user_id = $2 AND is_active = true) AS is_member
       FROM leagues l
       JOIN users u ON u.id = l.creator_id
       LEFT JOIN competitions c ON c.slug = l.tournament_slug
       WHERE l.invite_code = $1`,
      [req.params.code.toUpperCase(), req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'ליגה לא נמצאה. בדוק את הקוד שוב.' });
    res.json({ league: result.rows[0] });
  } catch (err) { next(err); }
});

// GET /api/leagues/public — discover public leagues
router.get('/public', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT l.id, l.name, l.description, l.format, l.entry_fee, l.pool_total, l.status, l.created_at,
              u.username AS creator_username,
              (SELECT COUNT(*) FROM league_members lm WHERE lm.league_id = l.id AND lm.is_active = true) AS member_count
       FROM leagues l
       JOIN users u ON u.id = l.creator_id
       WHERE l.access_type = 'public' AND l.status = 'active'
       ORDER BY l.created_at DESC LIMIT 50`
    );
    res.json({ leagues: result.rows });
  } catch (err) { next(err); }
});

// GET /api/leagues/my/list
router.get('/my/list', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT l.*, lm.points_in_league, lm.is_active,
              (SELECT COUNT(*) FROM league_members WHERE league_id = l.id AND is_active = true) AS member_count
       FROM leagues l JOIN league_members lm ON lm.league_id = l.id
       WHERE lm.user_id = $1 AND lm.is_active = true AND l.status IN ('active', 'paused')
       ORDER BY l.created_at DESC`,
      [req.user.id]
    );
    res.json({ leagues: result.rows });
  } catch (err) { next(err); }
});

// POST /api/leagues/:id/join-public — join a public league directly
router.post('/:id/join-public', authenticate, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const leagueRes = await client.query(`SELECT * FROM leagues WHERE id = $1`, [req.params.id]);
    const league = leagueRes.rows[0];
    if (!league) return res.status(404).json({ error: 'ליגה לא נמצאה' });
    if (league.access_type !== 'public') return res.status(403).json({ error: 'ליגה זו אינה ציבורית' });
    if (league.status !== 'active') return res.status(400).json({ error: 'הליגה אינה פעילה' });

    const memberCheck = await client.query(
      `SELECT id, is_active FROM league_members WHERE league_id = $1 AND user_id = $2`, [league.id, req.user.id]
    );
    if (memberCheck.rows[0]?.is_active) return res.status(409).json({ error: 'כבר חבר פעיל בליגה' });

    if (league.max_members) {
      const countRes = await client.query(
        `SELECT COUNT(*) FROM league_members WHERE league_id = $1 AND is_active = true`, [league.id]
      );
      if (parseInt(countRes.rows[0].count) >= league.max_members) {
        return res.status(400).json({ error: 'הליגה מלאה' });
      }
    }

    if (league.entry_fee > 0) {
      const balRes = await client.query(
        `UPDATE users SET points_balance = points_balance - $1
         WHERE id = $2 AND points_balance >= $1 RETURNING points_balance`,
        [league.entry_fee, req.user.id]
      );
      if (!balRes.rows[0]) throw Object.assign(new Error('אין מספיק נקודות לדמי כניסה'), { status: 400 });
      await client.query(`UPDATE leagues SET pool_total = pool_total + $1 WHERE id = $2`, [league.entry_fee, league.id]);
      await client.query(
        `INSERT INTO point_transactions (user_id, amount, type, reference_id, description)
         VALUES ($1,$2,'league_entry',$3,$4)`,
        [req.user.id, -league.entry_fee, league.id, `Entry fee: ${league.name}`]
      );
    }

    if (memberCheck.rows[0]) {
      await client.query(`UPDATE league_members SET is_active = true WHERE league_id = $1 AND user_id = $2`, [league.id, req.user.id]);
    } else {
      await client.query(`INSERT INTO league_members (league_id, user_id) VALUES ($1,$2)`, [league.id, req.user.id]);
    }
    await client.query('COMMIT');
    res.json({ message: 'הצטרפת לליגה', league });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

// GET /api/leagues/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const leagueRes = await pool.query(`SELECT * FROM leagues WHERE id = $1`, [req.params.id]);
    const league = leagueRes.rows[0];
    if (!league) return res.status(404).json({ error: 'League not found' });

    const membersRes = await pool.query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, lm.points_in_league, lm.joined_at, lm.is_active
       FROM league_members lm JOIN users u ON u.id = lm.user_id
       WHERE lm.league_id = $1 AND lm.is_active = true AND u.username NOT LIKE 'deleted_%'
       ORDER BY lm.points_in_league DESC`,
      [req.params.id]
    );

    res.json({ league, members: membersRes.rows });
  } catch (err) { next(err); }
});

// GET /api/leagues/:id/matches — tournament match obligations for current user
router.get('/:id/matches', authenticate, async (req, res, next) => {
  try {
    const leagueRes = await pool.query(`SELECT * FROM leagues WHERE id = $1`, [req.params.id]);
    const league = leagueRes.rows[0];
    if (!league) return res.status(404).json({ error: 'League not found' });
    if (!league.is_tournament || !league.tournament_slug) return res.status(400).json({ error: 'Not a tournament league' });

    const result = await pool.query(
      `SELECT DISTINCT ON (g.id)
              g.id, g.home_team, g.away_team, g.home_team_logo, g.away_team_logo,
              g.start_time, g.status, g.score_home, g.score_away,
              b.id AS bet_id, b.selected_outcome, b.stake, b.odds AS bet_odds, b.status AS bet_status, b.actual_payout, b.exact_score_prediction
       FROM games g
       JOIN competitions c ON c.id = g.competition_id
       LEFT JOIN bets b ON b.game_id = g.id AND b.user_id = $2 AND b.league_id = $3 AND b.status != 'cancelled'
       WHERE c.slug = $1
       ORDER BY g.id, b.placed_at DESC NULLS LAST`,
      [league.tournament_slug, req.user.id, req.params.id]
    );

    // Sort by start_time after DISTINCT ON
    result.rows.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

    res.json({ matches: result.rows, stake_per_match: league.stake_per_match });
  } catch (err) { next(err); }
});

// POST /api/leagues/:id/settle
router.post('/:id/settle', authenticate, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const leagueRes = await client.query(`SELECT * FROM leagues WHERE id = $1`, [req.params.id]);
    const league = leagueRes.rows[0];
    if (!league) return res.status(404).json({ error: 'League not found' });
    if (league.access_type === 'public') return res.status(403).json({ error: 'ליגות ציבוריות נסגרות על ידי מנהלי האתר בלבד' });
    if (league.creator_id !== req.user.id) return res.status(403).json({ error: 'Only creator can settle' });
    if (league.status !== 'active') return res.status(400).json({ error: 'League already settled' });
    if (!league.distribution && league.pool_total === 0) {
      return res.status(400).json({ error: 'No pool to distribute' });
    }

    await settleLeaguePool(client, league);
    await client.query('COMMIT');
    res.json({ message: 'League settled and payouts distributed' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

// POST /api/leagues/:id/invite — invite a user by username
router.post('/:id/invite', authenticate, async (req, res, next) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'username required' });

  try {
    const leagueRes = await pool.query(`SELECT * FROM leagues WHERE id = $1`, [req.params.id]);
    const league = leagueRes.rows[0];
    if (!league) return res.status(404).json({ error: 'League not found' });

    const memberCheck = await pool.query(
      `SELECT id FROM league_members WHERE league_id = $1 AND user_id = $2 AND is_active = true`,
      [league.id, req.user.id]
    );
    if (!memberCheck.rows[0]) return res.status(403).json({ error: 'Not a member of this league' });

    const targetRes = await pool.query(`SELECT id, username FROM users WHERE username ILIKE $1`, [username]);
    const target = targetRes.rows[0];
    if (!target) return res.status(404).json({ error: 'משתמש לא נמצא' });
    if (target.id === req.user.id) return res.status(400).json({ error: 'לא ניתן להזמין את עצמך' });

    const alreadyMember = await pool.query(
      `SELECT id FROM league_members WHERE league_id = $1 AND user_id = $2`,
      [league.id, target.id]
    );
    if (alreadyMember.rows[0]) return res.status(409).json({ error: 'משתמש כבר חבר בליגה' });

    const { createNotification } = require('../services/notificationService');
    await createNotification(target.id, {
      type: 'league_invite',
      title: `הוזמנת לליגה "${league.name}"`,
      body: `${req.user.username} מזמין אותך להצטרף`,
      data: { league_id: league.id, league_name: league.name, invite_code: league.invite_code, inviter: req.user.username },
    });

    res.json({ message: `הזמנה נשלחה ל-${target.username}` });
  } catch (err) { next(err); }
});

// ── Shared settlement logic (also used by auto-settle) ────────────────────────
async function settleLeaguePool(client, league) {
  const membersRes = await client.query(
    `SELECT user_id, points_in_league FROM league_members
     WHERE league_id = $1 AND is_active = true ORDER BY points_in_league DESC`,
    [league.id]
  );

  const dist = league.distribution || [{ place: 1, pct: 100 }];
  const rankEmoji = ['🥇', '🥈', '🥉'];

  const notificationRows = []; // collected for bulk insert

  for (let i = 0; i < membersRes.rows.length; i++) {
    const memberId = membersRes.rows[i].user_id;
    const rank = i + 1;
    const payout = i < dist.length ? Math.floor((dist[i].pct / 100) * league.pool_total) : 0;

    if (payout > 0) {
      await client.query(`UPDATE users SET points_balance = points_balance + $1 WHERE id = $2`, [payout, memberId]);
      await client.query(
        `INSERT INTO point_transactions (user_id, amount, type, reference_id, description)
         VALUES ($1,$2,'league_payout',$3,$4)`,
        [memberId, payout, league.id, `League payout: ${league.name} - Place ${rank}`]
      );
    }

    // Award league_champion achievement to first place (best-effort)
    if (rank === 1) {
      const { checkAndAwardAchievements } = require('../services/achievementService');
      checkAndAwardAchievements(memberId, 'league_champion').catch(() => {});
    }

    const emoji = rankEmoji[i] || `#${rank}`;
    notificationRows.push({
      user_id: memberId,
      type: 'league_result',
      title: `${emoji} הליגה "${league.name}" הסתיימה!`,
      body: payout > 0 ? `סיימת במקום ${rank} וקיבלת ${payout.toLocaleString()} נק׳!` : `סיימת במקום ${rank}`,
      data: JSON.stringify({ league_id: league.id, rank, payout }),
    });
  }

  await client.query(`UPDATE leagues SET status = 'finished' WHERE id = $1`, [league.id]);

  // WhatsApp league end notification (best-effort, after DB commit)
  if (process.env.STUB_MODE !== 'true') {
    try {
      const { notifyLeagueEnd } = require('../services/whatsappBotService');
      notifyLeagueEnd(league.id).catch(() => {});
    } catch (_) {}
  }

  // Bulk-insert all result notifications in a single query (best-effort, after transaction)
  if (notificationRows.length > 0 && process.env.STUB_MODE !== 'true') {
    const values = notificationRows.map((_, i) => {
      const base = i * 5;
      return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5})`;
    }).join(',');
    const params = notificationRows.flatMap(r => [r.user_id, r.type, r.title, r.body, r.data]);
    pool.query(
      `INSERT INTO notifications (user_id, type, title, body, data) VALUES ${values}`,
      params
    ).catch(err => console.error('[leagues] Bulk notification insert failed:', err.message));
  }
}

module.exports = router;
module.exports.settleLeaguePool = settleLeaguePool;
