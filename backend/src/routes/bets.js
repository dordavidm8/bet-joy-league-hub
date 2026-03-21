const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { calculatePayout } = require('../services/bettingService');

// POST /api/bets — place single bet
router.post('/', authenticate, async (req, res, next) => {
  const { game_id, bet_question_id, selected_outcome, stake } = req.body;
  if (!game_id || !bet_question_id || !selected_outcome || !stake) {
    return res.status(400).json({ error: 'game_id, bet_question_id, selected_outcome, stake required' });
  }
  if (!Number.isInteger(stake) || stake <= 0) {
    return res.status(400).json({ error: 'stake must be a positive integer' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const gameRes = await client.query('SELECT * FROM games WHERE id = $1', [game_id]);
    const game = gameRes.rows[0];
    if (!game) throw Object.assign(new Error('Game not found'), { status: 404 });
    if (['finished', 'cancelled', 'live'].includes(game.status)) {
      throw Object.assign(new Error('Game is closed for betting'), { status: 400 });
    }

    if (game.status === 'scheduled') {
      const now = new Date();
      const start = new Date(game.start_time);
      const oneMonthBefore = new Date(start.getTime() - 30 * 24 * 60 * 60 * 1000);
      const oneHourBefore = new Date(start.getTime() - 60 * 60 * 1000);
      if (now < oneMonthBefore || now > oneHourBefore) {
        throw Object.assign(new Error('Betting is only available from 1 month to 1 hour before the game'), { status: 400 });
      }
    }

    const qRes = await client.query(
      'SELECT * FROM bet_questions WHERE id = $1 AND game_id = $2', [bet_question_id, game_id]
    );
    const question = qRes.rows[0];
    if (!question) throw Object.assign(new Error('Bet question not found'), { status: 404 });
    if (question.is_locked) throw Object.assign(new Error('This bet is locked'), { status: 400 });

    const chosen = question.outcomes.find(o => o.label === selected_outcome);
    if (!chosen) throw Object.assign(new Error('Invalid option'), { status: 400 });

    const penaltyPct = 0;
    const potentialPayout = calculatePayout(stake, parseFloat(chosen.odds), penaltyPct);

    const balRes = await client.query(
      `UPDATE users SET points_balance = points_balance - $1, total_bets = total_bets + 1
       WHERE id = $2 AND points_balance >= $1 RETURNING points_balance`,
      [stake, req.user.id]
    );
    if (!balRes.rows[0]) throw Object.assign(new Error('Insufficient points'), { status: 400 });

    const betRes = await client.query(
      `INSERT INTO bets (user_id, game_id, bet_question_id, selected_outcome, stake, odds,
        live_penalty_pct, potential_payout, is_live_bet, match_minute_placed)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.user.id, game_id, bet_question_id, selected_outcome, stake, chosen.odds,
       penaltyPct, potentialPayout, false, null]
    );
    const bet = betRes.rows[0];

    await client.query(
      `INSERT INTO point_transactions (user_id, amount, type, reference_id, description)
       VALUES ($1, $2, 'bet_placed', $3, $4)`,
      [req.user.id, -stake, bet.id, `Bet: ${question.question_text}`]
    );

    await client.query('COMMIT');
    res.status(201).json({ bet, new_balance: balRes.rows[0].points_balance });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// POST /api/bets/parlay — place parlay bet
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
        'SELECT * FROM bet_questions WHERE id = $1 AND game_id = $2', [sel.bet_question_id, sel.game_id]
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

    const potentialPayout = Math.floor(stake * combinedOdds);

    const balRes = await client.query(
      `UPDATE users SET points_balance = points_balance - $1, total_bets = total_bets + 1
       WHERE id = $2 AND points_balance >= $1 RETURNING points_balance`,
      [stake, req.user.id]
    );
    if (!balRes.rows[0]) throw Object.assign(new Error('Insufficient points'), { status: 400 });

    const parlayRes = await client.query(
      `INSERT INTO parlays (user_id, total_stake, total_odds, potential_payout) VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.user.id, stake, combinedOdds.toFixed(2), potentialPayout]
    );
    const parlay = parlayRes.rows[0];

    for (const b of betData) {
      await client.query(
        `INSERT INTO bets (user_id, game_id, bet_question_id, selected_outcome, stake, odds,
          live_penalty_pct, potential_payout, is_live_bet, match_minute_placed, parlay_id)
         VALUES ($1,$2,$3,$4,0,$5,$6,0,$7,$8,$9)`,
        [req.user.id, b.game_id, b.bet_question_id, b.selected_outcome,
         b.odds, 0, false, null, parlay.id]
      );
    }

    await client.query(
      `INSERT INTO point_transactions (user_id, amount, type, reference_id, description) VALUES ($1,$2,'bet_placed',$3,'Parlay bet')`,
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

// GET /api/bets/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT b.*, g.home_team, g.away_team, g.start_time, bq.question_text
       FROM bets b JOIN games g ON g.id = b.game_id JOIN bet_questions bq ON bq.id = b.bet_question_id
       WHERE b.id = $1 AND b.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Bet not found' });
    res.json({ bet: result.rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
