const { pool } = require('../config/database');
const { calculatePayout } = require('../services/bettingService');

// ── Resolve a bet_question's correct_outcome based on final score ─────────────
// Returns the winning outcome label, or null if we can't determine yet.
function resolveQuestion(question, game) {
  if (game.status !== 'finished') return null;

  const h = game.score_home;
  const a = game.score_away;
  const type = question.type;

  if (type === 'match_winner') {
    if (h > a) return game.home_team;
    if (a > h) return game.away_team;
    return 'Draw';
  }

  if (type === 'both_teams_score') {
    return h > 0 && a > 0 ? 'Yes' : 'No';
  }

  if (type === 'over_under') {
    return (h + a) > 2.5 ? 'Over 2.5' : 'Under 2.5';
  }

  return null; // unknown question type
}

// ── Settle all pending bets for finished games ────────────────────────────────
async function settleBets() {
  if (process.env.STUB_MODE === 'true') {
    console.log('[settleBets] STUB_MODE — skipping settlement');
    return;
  }

  // Fetch finished games that still have pending bets
  const gamesRes = await pool.query(
    `SELECT DISTINCT g.id, g.home_team, g.away_team, g.score_home, g.score_away, g.status
     FROM games g
     JOIN bets b ON b.game_id = g.id
     WHERE g.status = 'finished' AND b.status = 'pending'`
  );

  if (!gamesRes.rows.length) {
    console.log('[settleBets] No pending bets for finished games');
    return;
  }

  console.log(`[settleBets] Settling bets for ${gamesRes.rows.length} games…`);

  for (const game of gamesRes.rows) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Resolve all bet_questions for this game
      const questionsRes = await client.query(
        `SELECT * FROM bet_questions WHERE game_id = $1`, [game.id]
      );

      const correctOutcomeMap = {}; // questionId → winning label
      for (const q of questionsRes.rows) {
        const winner = resolveQuestion(q, game);
        if (winner !== null) {
          correctOutcomeMap[q.id] = winner;
          await client.query(
            `UPDATE bet_questions SET correct_outcome = $1, resolved_at = NOW() WHERE id = $2`,
            [winner, q.id]
          );
        }
      }

      // Fetch pending bets for this game
      const betsRes = await client.query(
        `SELECT * FROM bets WHERE game_id = $1 AND status = 'pending'`, [game.id]
      );

      let settledWon = 0, settledLost = 0;
      for (const bet of betsRes.rows) {
        const correctOutcome = correctOutcomeMap[bet.bet_question_id];
        if (correctOutcome === undefined) continue; // question not resolved yet

        const won = bet.selected_outcome === correctOutcome;
        const payout = won ? calculatePayout(bet.stake, bet.odds, bet.penalty_pct || 0) : 0;

        await client.query(
          `UPDATE bets SET status = $1, actual_payout = $2, settled_at = NOW() WHERE id = $3`,
          [won ? 'won' : 'lost', payout, bet.id]
        );

        if (won) {
          await client.query(
            `UPDATE users SET points_balance = points_balance + $1, total_wins = total_wins + 1 WHERE id = $2`,
            [payout, bet.user_id]
          );
          await client.query(
            `INSERT INTO point_transactions (user_id, amount, type, reference_id, description)
             VALUES ($1,$2,'bet_won',$3,$4)`,
            [bet.user_id, payout, bet.id, `Bet won: ${game.home_team} vs ${game.away_team}`]
          );

          // Also update points_in_league for any league this user is in
          await client.query(
            `UPDATE league_members lm
             SET points_in_league = points_in_league + $1
             FROM leagues l
             WHERE lm.league_id = l.id
               AND lm.user_id = $2
               AND lm.is_active = true
               AND l.status = 'active'`,
            [payout, bet.user_id]
          );

          settledWon++;
        } else {
          settledLost++;
        }
      }

      // Also settle parlays that include this game's bets
      await settleParlays(client, game.id, correctOutcomeMap);

      await client.query('COMMIT');
      console.log(`[settleBets] Game ${game.id}: ${settledWon} won, ${settledLost} lost`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`[settleBets] Error settling game ${game.id}:`, err.message);
    } finally {
      client.release();
    }
  }
}

// ── Settle parlays: a parlay wins only if ALL its legs win ────────────────────
async function settleParlays(client, gameId, correctOutcomeMap) {
  // Find parlays that have legs on this game and are still pending
  const parlayRes = await client.query(
    `SELECT DISTINCT p.id FROM parlays p
     JOIN bets b ON b.parlay_id = p.id
     WHERE b.game_id = $1 AND p.status = 'pending'`,
    [gameId]
  );

  for (const { id: parlayId } of parlayRes.rows) {
    const legsRes = await client.query(
      `SELECT b.status, b.stake, b.odds, b.penalty_pct FROM bets b WHERE b.parlay_id = $1`,
      [parlayId]
    );

    const allSettled = legsRes.rows.every(l => l.status !== 'pending');
    if (!allSettled) continue;

    const allWon = legsRes.rows.every(l => l.status === 'won');
    const parlayRow = await client.query(`SELECT * FROM parlays WHERE id = $1`, [parlayId]);
    const parlay = parlayRow.rows[0];
    if (!parlay) continue;

    const payout = allWon ? parlay.potential_payout : 0;

    await client.query(
      `UPDATE parlays SET status = $1, actual_payout = $2, settled_at = NOW() WHERE id = $3`,
      [allWon ? 'won' : 'lost', payout, parlayId]
    );

    if (allWon) {
      await client.query(
        `UPDATE users SET points_balance = points_balance + $1, total_wins = total_wins + 1 WHERE id = $2`,
        [payout, parlay.user_id]
      );
      await client.query(
        `INSERT INTO point_transactions (user_id, amount, type, reference_id, description)
         VALUES ($1,$2,'bet_won',$3,'Parlay won')`,
        [parlay.user_id, payout, parlayId]
      );
    }
  }
}

module.exports = { settleBets };
