const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { calculatePayout } = require('../services/bettingService');
const { checkAndAwardAchievements } = require('../services/achievementService');

// ── Helpers ───────────────────────────────────────────────────────────────────

function validateGameWindow(game) {
  if (['finished', 'cancelled', 'live'].includes(game.status)) {
    throw Object.assign(new Error('Game is closed for betting'), { status: 400 });
  }
  if (game.status === 'scheduled') {
    const now = new Date();
    const start = new Date(game.start_time);
    const oneMonthBefore = new Date(start.getTime() - 30 * 24 * 60 * 60 * 1000);
    const tenMinutesBefore = new Date(start.getTime() - 10 * 60 * 1000);
    if (now < oneMonthBefore || now > tenMinutesBefore) {
      throw Object.assign(
        new Error('Betting is only available from 1 month to 10 minutes before the game'),
        { status: 400 }
      );
    }
  }
}

// ── POST /api/bets ─────────────────────────────────────────────────────────────
// Accepts:
//   league_id  (string|null)   – single-league or global (null) bet
//   league_ids (string[])      – "merge": same prediction across multiple leagues
//
// bet_mode per league:
//   'initial_balance' → no stake deducted; win credits odds to points_in_league
//   'minimum_stake'   → stake deducted from global balance; win credits global + league
//   global (null)     → stake deducted from global balance; win credits global only
router.post('/', authenticate, async (req, res, next) => {
  const {
    game_id, bet_question_id, selected_outcome, stake,
    league_id, league_ids, exact_score_prediction,
  } = req.body;

  if (!game_id || !bet_question_id || !selected_outcome) {
    return res.status(400).json({ error: 'game_id, bet_question_id, selected_outcome required' });
  }

  // Determine target contexts: array of (league_id | null)
  let targets;
  if (Array.isArray(league_ids) && league_ids.length > 0) {
    targets = league_ids;
  } else if (league_id !== undefined) {
    targets = [league_id ?? null];
  } else {
    targets = [null]; // global
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Validate game
    const gameRes = await client.query('SELECT * FROM games WHERE id = $1', [game_id]);
    const game = gameRes.rows[0];
    if (!game) throw Object.assign(new Error('Game not found'), { status: 404 });
    validateGameWindow(game);

    // Validate question
    const qRes = await client.query(
      'SELECT * FROM bet_questions WHERE id = $1 AND game_id = $2',
      [bet_question_id, game_id]
    );
    const question = qRes.rows[0];
    if (!question) throw Object.assign(new Error('Bet question not found'), { status: 404 });
    if (question.is_locked) throw Object.assign(new Error('This bet is locked'), { status: 400 });

    const chosen = question.outcomes.find(o => o.label === selected_outcome);
    if (!chosen) throw Object.assign(new Error('Invalid option'), { status: 400 });

    // Validate exact score prediction if provided
    const cleanExactScore = exact_score_prediction?.trim() || null;
    if (cleanExactScore) {
      const scoreMatch = cleanExactScore.match(/^(\d+)-(\d+)$/);
      if (!scoreMatch) throw Object.assign(new Error('פורמט תוצאה מדויקת לא תקין — לדוגמה: 2-1'), { status: 400 });
      const sh = parseInt(scoreMatch[1]);
      const sa = parseInt(scoreMatch[2]);
      if (question.type === 'match_winner') {
        if (selected_outcome === game.home_team && sh <= sa)
          throw Object.assign(new Error(`תוצאה מדויקת לא מתאימה — ${game.home_team} חייבת לנצח`), { status: 400 });
        if (selected_outcome === game.away_team && sa <= sh)
          throw Object.assign(new Error(`תוצאה מדויקת לא מתאימה — ${game.away_team} חייבת לנצח`), { status: 400 });
        if (selected_outcome === 'Draw' && sh !== sa)
          throw Object.assign(new Error('תוצאה מדויקת לא מתאימה — תיקו דורש מספרים שווים'), { status: 400 });
      }
    }

    const baseOdds = parseFloat(chosen.odds) *
      (1 + (game.is_featured ? (game.featured_bonus_pct || 0) : 0) / 100);

    // Load league data for each non-global target
    const leagueData = {}; // leagueId → { bet_mode, min_bet, name }
    for (const lid of targets) {
      if (lid === null) continue;
      const lRes = await client.query(
        `SELECT lm.is_active, l.bet_mode, l.min_bet, l.name, l.status, l.is_tournament
         FROM league_members lm JOIN leagues l ON l.id = lm.league_id
         WHERE lm.league_id = $1 AND lm.user_id = $2`,
        [lid, req.user.id]
      );
      const row = lRes.rows[0];
      if (!row || !row.is_active) throw Object.assign(new Error('לא חבר בליגה'), { status: 403 });
      if (row.status !== 'active') throw Object.assign(new Error('הליגה לא פעילה'), { status: 400 });
      if (row.is_tournament && (question.type === 'over_under' || question.type === 'both_teams_score' || question.type === 'btts')) {
        throw Object.assign(new Error(`לא ניתן להמר על סוג שאלה זה בליגת טורניר (${row.name})`), { status: 400 });
      }
      leagueData[lid] = row;
    }

    // Check which targets require a real stake (non initial_balance)
    const stakeTargets = targets.filter(
      lid => lid === null || leagueData[lid]?.bet_mode !== 'initial_balance'
    );

    if (stakeTargets.length > 0) {
      if (!Number.isInteger(stake) || stake <= 0) {
        return res.status(400).json({ error: 'stake must be a positive integer' });
      }
      // Validate min_bet per minimum_stake league
      for (const lid of targets) {
        if (lid === null) continue;
        const lData = leagueData[lid];
        if (lData.bet_mode === 'minimum_stake' && lData.min_bet > 0 && stake < lData.min_bet) {
          throw Object.assign(
            new Error(`הליגה "${lData.name}" דורשת הימור מינימלי של ${lData.min_bet} נק׳`),
            { status: 400 }
          );
        }
      }
    }

    // Check for existing bets (prevent duplicates per context)
    for (const lid of targets) {
      const dupCheck = await client.query(
        `SELECT id FROM bets WHERE user_id = $1 AND bet_question_id = $2
         AND (($3::uuid IS NULL AND league_id IS NULL) OR league_id = $3)`,
        [req.user.id, bet_question_id, lid]
      );
      if (dupCheck.rows[0]) {
        const ctx = lid ? leagueData[lid]?.name : 'הימור חופשי';
        throw Object.assign(new Error(`כבר המרת על שאלה זו (${ctx})`), { status: 409 });
      }
    }

    // Deduct total stake from global balance
    const totalStake = stakeTargets.length * (stake || 0);
    let newBalance;
    if (totalStake > 0) {
      const balRes = await client.query(
        `UPDATE users
         SET points_balance = points_balance - $1,
             total_bets = total_bets + $2
         WHERE id = $3 AND points_balance >= $1
         RETURNING points_balance`,
        [totalStake, targets.length, req.user.id]
      );
      if (!balRes.rows[0]) throw Object.assign(new Error('Insufficient points'), { status: 400 });
      newBalance = balRes.rows[0].points_balance;
    } else {
      // Initial-balance-only bets: no stake deducted, but still count toward total_bets
      const balRes = await client.query(
        `UPDATE users SET total_bets = total_bets + $1 WHERE id = $2 RETURNING points_balance`,
        [targets.length, req.user.id]
      );
      newBalance = balRes.rows[0]?.points_balance;
    }

    // Insert one bet record per target
    const bets = [];
    for (const lid of targets) {
      const lData = lid ? leagueData[lid] : null;
      const isInitialBalance = lData?.bet_mode === 'initial_balance';
      const betStake = isInitialBalance ? 0 : (stake || 0);
      const potentialPayout = isInitialBalance ? 0 : calculatePayout(betStake, baseOdds, 0);

      const betRes = await client.query(
        `INSERT INTO bets
           (user_id, game_id, bet_question_id, selected_outcome, stake, odds,
            live_penalty_pct, potential_payout, is_live_bet, match_minute_placed, league_id, exact_score_prediction)
         VALUES ($1,$2,$3,$4,$5,$6,0,$7,false,NULL,$8,$9)
         RETURNING *`,
        [req.user.id, game_id, bet_question_id, selected_outcome,
         betStake, chosen.odds, potentialPayout, lid, cleanExactScore]
      );
      const bet = betRes.rows[0];
      bets.push(bet);

      if (!isInitialBalance) {
        await client.query(
          `INSERT INTO point_transactions
             (user_id, amount, type, reference_id, description)
           VALUES ($1,$2,'bet_placed',$3,$4)`,
          [req.user.id, -betStake, bet.id,
           `Bet: ${question.question_text}${lData ? ` · ${lData.name}` : ''}`]
        );
      }
    }

    await client.query('COMMIT');

    // Achievements (best-effort)
    const hasRealStake = bets.some(b => b.stake > 0);
    if (hasRealStake) {
      checkAndAwardAchievements(req.user.id, 'bet_placed').catch(() => {});
      if (bets.some(b => b.stake >= 1000)) {
        checkAndAwardAchievements(req.user.id, 'high_roller').catch(() => {});
      }
    }

    res.status(201).json({ bets, bet: bets[0], new_balance: newBalance });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ── POST /api/bets/parlay ──────────────────────────────────────────────────────
// Parlays remain global (league_id = NULL)
router.post('/parlay', authenticate, async (req, res, next) => {
  const { legs, stake } = req.body;
  if (!Array.isArray(legs) || legs.length < 2) {
    return res.status(400).json({ error: 'Parlay requires at least 2 selections' });
  }
  if (!Number.isInteger(stake) || stake <= 0) {
    return res.status(400).json({ error: 'stake must be a positive integer' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let combinedOdds = 1;
    const betData = [];

    for (const sel of legs) {
      const gameRes = await client.query('SELECT * FROM games WHERE id = $1', [sel.game_id]);
      const game = gameRes.rows[0];
      if (!game || ['finished', 'cancelled', 'live'].includes(game.status)) {
        throw Object.assign(new Error(`Game unavailable: ${sel.game_id}`), { status: 400 });
      }
      const qRes = await client.query(
        'SELECT * FROM bet_questions WHERE id = $1 AND game_id = $2',
        [sel.bet_question_id, sel.game_id]
      );
      const question = qRes.rows[0];
      if (!question || question.is_locked) {
        throw Object.assign(new Error('A selection is locked or invalid'), { status: 400 });
      }
      const chosen = question.outcomes.find(o => o.label === sel.selected_outcome);
      if (!chosen) throw Object.assign(new Error('Invalid option'), { status: 400 });

      const odds = parseFloat(chosen.odds);
      combinedOdds *= odds;
      betData.push({ ...sel, odds, questionText: question.question_text });
    }

    const bonus = betData.length >= 4 ? 1.20 : betData.length >= 3 ? 1.15 : 1.10;
    const potentialPayout = Math.floor(stake * combinedOdds * bonus);

    const balRes = await client.query(
      `UPDATE users SET points_balance = points_balance - $1, total_bets = total_bets + 1
       WHERE id = $2 AND points_balance >= $1 RETURNING points_balance`,
      [stake, req.user.id]
    );
    if (!balRes.rows[0]) throw Object.assign(new Error('Insufficient points'), { status: 400 });

    const parlayRes = await client.query(
      `INSERT INTO parlays (user_id, total_stake, total_odds, potential_payout)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.user.id, stake, combinedOdds.toFixed(2), potentialPayout]
    );
    const parlay = parlayRes.rows[0];

    for (const b of betData) {
      await client.query(
        `INSERT INTO bets
           (user_id, game_id, bet_question_id, selected_outcome, stake, odds,
            live_penalty_pct, potential_payout, is_live_bet, match_minute_placed, parlay_id)
         VALUES ($1,$2,$3,$4,0,$5,0,0,false,NULL,$6)`,
        [req.user.id, b.game_id, b.bet_question_id, b.selected_outcome, b.odds, parlay.id]
      );
    }

    await client.query(
      `INSERT INTO point_transactions (user_id, amount, type, reference_id, description)
       VALUES ($1,$2,'bet_placed',$3,'Parlay bet')`,
      [req.user.id, -stake, parlay.id]
    );

    await client.query('COMMIT');
    res.status(201).json({ parlay, new_balance: balRes.rows[0].points_balance });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ── GET /api/bets/:id ─────────────────────────────────────────────────────────
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT b.*, g.home_team, g.away_team, g.start_time, bq.question_text,
              l.name AS league_name, l.bet_mode
       FROM bets b
       JOIN games g ON g.id = b.game_id
       JOIN bet_questions bq ON bq.id = b.bet_question_id
       LEFT JOIN leagues l ON l.id = b.league_id
       WHERE b.id = $1 AND b.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Bet not found' });
    res.json({ bet: result.rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
