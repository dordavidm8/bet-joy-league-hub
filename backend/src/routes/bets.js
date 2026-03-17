const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const {
  getLivePenalty,
  isLiveBettingAllowed,
  calculatePayout,
} = require('../services/bettingService');

// POST /api/bets — place a single bet
router.post('/', authenticate, async (req, res, next) => {
  const { game_id, bet_question_id, selected_option, stake } = req.body;

  if (!game_id || !bet_question_id || !selected_option || !stake) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!Number.isInteger(stake) || stake <= 0) {
    return res.status(400).json({ error: 'Stake must be a positive integer' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch game + question
    const gameRes = await client.query('SELECT * FROM games WHERE id = $1', [game_id]);
    const game = gameRes.rows[0];
    if (!game) throw Object.assign(new Error('Game not found'), { status: 404 });
    if (game.status === 'finished' || game.status === 'cancelled') {
      throw Object.assign(new Error('Game is no longer open for betting'), { status: 400 });
    }

    const questionRes = await client.query(
      'SELECT * FROM bet_questions WHERE id = $1 AND game_id = $2',
      [bet_question_id, game_id]
    );
    const question = questionRes.rows[0];
    if (!question) throw Object.assign(new Error('Bet question not found'), { status: 404 });
    if (question.is_locked) {
      throw Object.assign(new Error('This bet is no longer available'), { status: 400 });
    }

    // Live betting checks
    const isLive = game.status === 'live';
    const matchMinute = game.minute;

    if (isLive) {
      if (!isLiveBettingAllowed(matchMinute)) {
        throw Object.assign(
          new Error(`Live betting is closed after minute ${question.live_lock_minute}`),
          { status: 400 }
        );
      }
      if (!question.is_available_live) {
        throw Object.assign(new Error('This bet is not available during live play'), { status: 400 });
      }
    }

    // Resolve odds from question options
    const options = question.options; // JSONB array
    const chosenOption = options.find((o) => o.key === selected_option);
    if (!chosenOption) {
      throw Object.assign(new Error('Invalid option selected'), { status: 400 });
    }
    const odds = parseFloat(chosenOption.odds);

    // Calculate penalty and payout
    const penaltyPct = isLive ? (getLivePenalty(matchMinute) ?? 0) : 0;
    const potentialPayout = calculatePayout(stake, odds, penaltyPct);

    // Deduct stake from user balance
    const balanceRes = await client.query(
      'UPDATE users SET points_balance = points_balance - $1, total_bets = total_bets + 1 WHERE id = $2 AND points_balance >= $1 RETURNING points_balance',
      [stake, req.user.id]
    );
    if (!balanceRes.rows[0]) {
      throw Object.assign(new Error('Insufficient points balance'), { status: 400 });
    }

    // Create bet
    const betRes = await client.query(
      `INSERT INTO bets
         (user_id, game_id, bet_question_id, selected_option, stake, odds,
          live_penalty_pct, potential_payout, is_live_bet, match_minute_placed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        req.user.id, game_id, bet_question_id, selected_option,
        stake, odds, penaltyPct, potentialPayout,
        isLive, isLive ? matchMinute : null,
      ]
    );
    const bet = betRes.rows[0];

    // Log transaction
    await client.query(
      `INSERT INTO point_transactions (user_id, amount, type, reference_id, description)
       VALUES ($1, $2, 'bet_placed', $3, $4)`,
      [req.user.id, -stake, bet.id, `Bet on: ${question.question_text}`]
    );

    await client.query('COMMIT');
    res.status(201).json({
      bet,
      new_balance: balanceRes.rows[0].points_balance,
      penalty_applied: penaltyPct > 0 ? `${penaltyPct}% live penalty` : null,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// POST /api/bets/parlay — place a parlay (combined) bet
router.post('/parlay', authenticate, async (req, res, next) => {
  const { selections, stake } = req.body;
  // selections: [{ game_id, bet_question_id, selected_option }, ...]

  if (!Array.isArray(selections) || selections.length < 2) {
    return res.status(400).json({ error: 'Parlay requires at least 2 selections' });
  }
  if (!Number.isInteger(stake) || stake <= 0) {
    return res.status(400).json({ error: 'Stake must be a positive integer' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let combinedOdds = 1;
    const betData = [];

    for (const sel of selections) {
      const gameRes = await client.query('SELECT * FROM games WHERE id = $1', [sel.game_id]);
      const game = gameRes.rows[0];
      if (!game) throw Object.assign(new Error(`Game ${sel.game_id} not found`), { status: 404 });
      if (game.status === 'finished' || game.status === 'cancelled') {
        throw Object.assign(new Error(`Game ${game.home_team} vs ${game.away_team} is closed`), { status: 400 });
      }

      const questionRes = await client.query(
        'SELECT * FROM bet_questions WHERE id = $1 AND game_id = $2',
        [sel.bet_question_id, sel.game_id]
      );
      const question = questionRes.rows[0];
      if (!question || question.is_locked) {
        throw Object.assign(new Error('A selected bet is no longer available'), { status: 400 });
      }

      const isLive = game.status === 'live';
      if (isLive && !isLiveBettingAllowed(game.minute)) {
        throw Object.assign(new Error('Live betting is closed for one of the selected games'), { status: 400 });
      }

      const options = question.options;
      const chosenOption = options.find((o) => o.key === sel.selected_option);
      if (!chosenOption) throw Object.assign(new Error('Invalid option'), { status: 400 });

      const odds = parseFloat(chosenOption.odds);
      const penaltyPct = isLive ? (getLivePenalty(game.minute) ?? 0) : 0;
      const adjustedOdds = odds * (1 - penaltyPct / 100);
      combinedOdds *= adjustedOdds;

      betData.push({
        game_id: sel.game_id,
        bet_question_id: sel.bet_question_id,
        selected_option: sel.selected_option,
        odds,
        penaltyPct,
        isLive,
        matchMinute: isLive ? game.minute : null,
        questionText: question.question_text,
      });
    }

    const potentialPayout = Math.floor(stake * combinedOdds);

    // Deduct stake
    const balanceRes = await client.query(
      'UPDATE users SET points_balance = points_balance - $1, total_bets = total_bets + 1 WHERE id = $2 AND points_balance >= $1 RETURNING points_balance',
      [stake, req.user.id]
    );
    if (!balanceRes.rows[0]) {
      throw Object.assign(new Error('Insufficient points balance'), { status: 400 });
    }

    // Create parlay record
    const parlayRes = await client.query(
      `INSERT INTO parlays (user_id, total_stake, total_odds, potential_payout)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.id, stake, combinedOdds.toFixed(2), potentialPayout]
    );
    const parlay = parlayRes.rows[0];

    // Create individual bet rows
    for (const b of betData) {
      await client.query(
        `INSERT INTO bets
           (user_id, game_id, bet_question_id, selected_option, stake, odds,
            live_penalty_pct, potential_payout, is_live_bet, match_minute_placed, parlay_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          req.user.id, b.game_id, b.bet_question_id, b.selected_option,
          0, b.odds, b.penaltyPct, 0,
          b.isLive, b.matchMinute, parlay.id,
        ]
      );
    }

    await client.query(
      `INSERT INTO point_transactions (user_id, amount, type, reference_id, description)
       VALUES ($1, $2, 'bet_placed', $3, 'Parlay bet')`,
      [req.user.id, -stake, parlay.id]
    );

    await client.query('COMMIT');
    res.status(201).json({
      parlay,
      new_balance: balanceRes.rows[0].points_balance,
    });
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
      `SELECT b.*, g.home_team, g.away_team, g.start_time, g.status AS game_status,
              bq.question_text, bq.options
       FROM bets b
       JOIN games g ON g.id = b.game_id
       JOIN bet_questions bq ON bq.id = b.bet_question_id
       WHERE b.id = $1 AND b.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Bet not found' });
    res.json({ bet: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
