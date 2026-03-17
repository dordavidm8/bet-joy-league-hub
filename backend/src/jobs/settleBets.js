/**
 * Cron job: settle pending bets for finished games
 * Runs every 5 minutes
 */

const { pool } = require('../config/database');
const sportsApi = require('../services/sportsApi');

async function settleBets() {
  const client = await pool.connect();
  try {
    // Find finished games with unsettled bets
    const gamesRes = await client.query(
      `SELECT DISTINCT g.id, g.api_id, g.home_score, g.away_score
       FROM games g
       JOIN bets b ON b.game_id = g.id
       WHERE g.status = 'finished'
         AND b.status = 'pending'
         AND b.parlay_id IS NULL`
    );

    for (const game of gamesRes.rows) {
      await settleGameBets(client, game);
    }

    // Settle parlays separately
    await settleParlays(client);
  } catch (err) {
    console.error('[settleBets] Error:', err.message);
  } finally {
    client.release();
  }
}

async function settleGameBets(client, game) {
  // Fetch all bet questions for this game that have correct answers
  const questionsRes = await client.query(
    `SELECT * FROM bet_questions WHERE game_id = $1 AND correct_option IS NOT NULL`,
    [game.id]
  );

  for (const question of questionsRes.rows) {
    // Fetch all pending bets on this question
    const betsRes = await client.query(
      `SELECT * FROM bets WHERE bet_question_id = $1 AND status = 'pending' AND parlay_id IS NULL`,
      [question.id]
    );

    for (const bet of betsRes.rows) {
      const won = bet.selected_option === question.correct_option;
      const newStatus = won ? 'won' : 'lost';
      const payout = won ? bet.potential_payout : 0;

      await client.query(
        `UPDATE bets SET status = $1, actual_payout = $2, settled_at = NOW() WHERE id = $3`,
        [newStatus, payout, bet.id]
      );

      if (won) {
        await client.query(
          'UPDATE users SET points_balance = points_balance + $1, total_wins = total_wins + 1 WHERE id = $2',
          [payout, bet.user_id]
        );
        await client.query(
          `INSERT INTO point_transactions (user_id, amount, type, reference_id, description)
           VALUES ($1,$2,'bet_won',$3,'Bet won')`,
          [bet.user_id, payout, bet.id]
        );
      }

      // Update league points if user is in any league
      await updateLeaguePoints(client, bet.user_id, won ? payout - bet.stake : -bet.stake);
    }
  }

  console.log(`[settleBets] Settled game ${game.id}`);
}

async function settleParlays(client) {
  // A parlay wins only if ALL its bets win
  const parlaysRes = await client.query(
    `SELECT DISTINCT p.id, p.user_id, p.total_stake, p.potential_payout
     FROM parlays p
     JOIN bets b ON b.parlay_id = p.id
     WHERE p.status = 'pending'
       AND NOT EXISTS (
         SELECT 1 FROM bets b2
         JOIN games g ON g.id = b2.game_id
         WHERE b2.parlay_id = p.id AND g.status != 'finished'
       )`
  );

  for (const parlay of parlaysRes.rows) {
    const betsRes = await client.query(
      `SELECT b.*, bq.correct_option FROM bets b
       JOIN bet_questions bq ON bq.id = b.bet_question_id
       WHERE b.parlay_id = $1`,
      [parlay.id]
    );

    const allWon = betsRes.rows.every(
      (b) => b.selected_option === b.correct_option
    );
    const newStatus = allWon ? 'won' : 'lost';
    const payout = allWon ? parlay.potential_payout : 0;

    await client.query(
      `UPDATE parlays SET status = $1, actual_payout = $2, settled_at = NOW() WHERE id = $3`,
      [newStatus, payout, parlay.id]
    );
    await client.query(
      `UPDATE bets SET status = $1, settled_at = NOW() WHERE parlay_id = $2`,
      [newStatus, parlay.id]
    );

    if (allWon) {
      await client.query(
        'UPDATE users SET points_balance = points_balance + $1, total_wins = total_wins + 1 WHERE id = $2',
        [payout, parlay.user_id]
      );
      await client.query(
        `INSERT INTO point_transactions (user_id, amount, type, reference_id, description)
         VALUES ($1,$2,'bet_won',$3,'Parlay won')`,
        [parlay.user_id, payout, parlay.id]
      );
    }
  }
}

async function updateLeaguePoints(client, userId, delta) {
  await client.query(
    `UPDATE league_members
     SET points_in_league = points_in_league + $1
     WHERE user_id = $2 AND is_active = true`,
    [delta, userId]
  );
}

/**
 * Set correct answers for bet questions after game ends
 * Called by syncGames after status changes to 'finished'
 */
async function resolveGameQuestions(gameId, homeScore, awayScore) {
  const client = await pool.connect();
  try {
    const questionsRes = await client.query(
      `SELECT * FROM bet_questions WHERE game_id = $1 AND correct_option IS NULL`,
      [gameId]
    );

    for (const q of questionsRes.rows) {
      const correctOption = resolveQuestion(q, homeScore, awayScore);
      if (correctOption) {
        await client.query(
          'UPDATE bet_questions SET correct_option = $1, is_locked = true WHERE id = $2',
          [correctOption, q.id]
        );
      }
    }
  } finally {
    client.release();
  }
}

function resolveQuestion(question, homeScore, awayScore) {
  const totalGoals = (homeScore || 0) + (awayScore || 0);

  switch (question.question_type) {
    case 'winner':
      if (homeScore > awayScore) return 'home';
      if (awayScore > homeScore) return 'away';
      return 'draw';

    case 'both_teams_score':
      return homeScore > 0 && awayScore > 0 ? 'yes' : 'no';

    case 'total_goals':
      return totalGoals > 2.5 ? 'over' : 'under';

    default:
      return null; // manual resolution needed
  }
}

module.exports = { settleBets, resolveGameQuestions };
