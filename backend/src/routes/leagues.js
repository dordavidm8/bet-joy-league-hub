const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');

function generateInviteCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

// POST /api/leagues — create
router.post('/', authenticate, async (req, res, next) => {
  const { name, description, format, duration_type, access_type, min_bet, entry_fee, distribution, allowed_competitions, season_end_date } = req.body;
  if (!name || !format || !duration_type) {
    return res.status(400).json({ error: 'name, format, duration_type required' });
  }
  if (!['pool', 'per_game'].includes(format)) {
    return res.status(400).json({ error: 'format must be pool or per_game' });
  }
  if (format === 'pool' && distribution) {
    const total = distribution.reduce((sum, d) => sum + d.pct, 0);
    if (total !== 100) return res.status(400).json({ error: 'Distribution must sum to 100' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const invite_code = generateInviteCode();
    const leagueRes = await client.query(
      `INSERT INTO leagues (name, description, creator_id, invite_code, format, duration_type, access_type, min_bet, entry_fee, distribution, allowed_competitions, season_end_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [name, description || null, req.user.id, invite_code, format, duration_type,
       access_type || 'invite', min_bet || 10, entry_fee || 0,
       distribution ? JSON.stringify(distribution) : null,
       allowed_competitions ? JSON.stringify(allowed_competitions) : null,
       season_end_date || null]
    );
    const league = leagueRes.rows[0];

    if (format === 'pool' && entry_fee > 0) {
      const balRes = await client.query(
        `UPDATE users SET points_balance = points_balance - $1 WHERE id = $2 AND points_balance >= $1 RETURNING points_balance`,
        [entry_fee, req.user.id]
      );
      if (!balRes.rows[0]) throw Object.assign(new Error('Insufficient points for entry fee'), { status: 400 });
      await client.query(`UPDATE leagues SET pool_total = pool_total + $1 WHERE id = $2`, [entry_fee, league.id]);
      await client.query(
        `INSERT INTO point_transactions (user_id, amount, type, reference_id, description) VALUES ($1,$2,'league_entry',$3,$4)`,
        [req.user.id, -entry_fee, league.id, `Entry fee: ${name}`]
      );
    }

    await client.query(`INSERT INTO league_members (league_id, user_id) VALUES ($1,$2)`, [league.id, req.user.id]);
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
      `SELECT id FROM league_members WHERE league_id = $1 AND user_id = $2`, [league.id, req.user.id]
    );
    if (memberCheck.rows[0]) return res.status(409).json({ error: 'Already a member' });

    if (league.format === 'pool' && league.entry_fee > 0) {
      const balRes = await client.query(
        `UPDATE users SET points_balance = points_balance - $1 WHERE id = $2 AND points_balance >= $1 RETURNING points_balance`,
        [league.entry_fee, req.user.id]
      );
      if (!balRes.rows[0]) throw Object.assign(new Error('Insufficient points for entry fee'), { status: 400 });
      await client.query(`UPDATE leagues SET pool_total = pool_total + $1 WHERE id = $2`, [league.entry_fee, league.id]);
      await client.query(
        `INSERT INTO point_transactions (user_id, amount, type, reference_id, description) VALUES ($1,$2,'league_entry',$3,$4)`,
        [req.user.id, -league.entry_fee, league.id, `Entry fee: ${league.name}`]
      );
    }

    await client.query(`INSERT INTO league_members (league_id, user_id) VALUES ($1,$2)`, [league.id, req.user.id]);
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
    if (league.creator_id === req.user.id) return res.status(400).json({ error: 'Creator cannot leave' });

    await client.query(
      `UPDATE league_members SET is_active = false WHERE league_id = $1 AND user_id = $2`,
      [league.id, req.user.id]
    );
    await client.query('COMMIT');
    res.json({ message: 'Left league. Entry fee forfeited.' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

// GET /api/leagues/my/list
router.get('/my/list', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT l.*, lm.points_in_league, lm.is_active,
              (SELECT COUNT(*) FROM league_members WHERE league_id = l.id AND is_active = true) AS member_count
       FROM leagues l JOIN league_members lm ON lm.league_id = l.id
       WHERE lm.user_id = $1 ORDER BY l.created_at DESC`,
      [req.user.id]
    );
    res.json({ leagues: result.rows });
  } catch (err) { next(err); }
});

// GET /api/leagues/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const leagueRes = await pool.query(`SELECT * FROM leagues WHERE id = $1`, [req.params.id]);
    const league = leagueRes.rows[0];
    if (!league) return res.status(404).json({ error: 'League not found' });

    const membersRes = await pool.query(
      `SELECT u.id, u.username, u.avatar_url, lm.points_in_league, lm.joined_at, lm.is_active
       FROM league_members lm JOIN users u ON u.id = lm.user_id
       WHERE lm.league_id = $1 ORDER BY lm.points_in_league DESC`,
      [req.params.id]
    );
    res.json({ league, members: membersRes.rows });
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
    if (league.creator_id !== req.user.id) return res.status(403).json({ error: 'Only creator can settle' });
    if (league.status !== 'active') return res.status(400).json({ error: 'League already settled' });
    if (league.format !== 'pool' || !league.distribution) {
      return res.status(400).json({ error: 'Only pool leagues with distribution can be settled' });
    }

    const membersRes = await client.query(
      `SELECT user_id, points_in_league FROM league_members WHERE league_id = $1 AND is_active = true ORDER BY points_in_league DESC`,
      [league.id]
    );
    for (let i = 0; i < league.distribution.length && i < membersRes.rows.length; i++) {
      const payout = Math.floor((league.distribution[i].pct / 100) * league.pool_total);
      const winnerId = membersRes.rows[i].user_id;
      await client.query(`UPDATE users SET points_balance = points_balance + $1 WHERE id = $2`, [payout, winnerId]);
      await client.query(
        `INSERT INTO point_transactions (user_id, amount, type, reference_id, description) VALUES ($1,$2,'league_payout',$3,$4)`,
        [winnerId, payout, league.id, `League payout: ${league.name} - Place ${i + 1}`]
      );
    }

    await client.query(`UPDATE leagues SET status = 'finished' WHERE id = $1`, [league.id]);
    await client.query('COMMIT');
    res.json({ message: 'League settled and payouts distributed' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

module.exports = router;
