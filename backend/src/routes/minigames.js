const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');

// Helper to normalize strings for comparison (accents, case, spaces)
function normalizeName(name) {
  if (!name) return '';
  return name
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' '); // collapse multiple spaces
}

router.use(authenticate);

// 1. Start Game Endpoint
router.post('/:id/start', async (req, res, next) => {
  const { id: gameId } = req.params;
  const userId = req.user.id;

  try {
    // Check for existing attempt
    const existing = await pool.query(
      'SELECT * FROM game_attempts WHERE user_id = $1 AND game_id = $2',
      [userId, gameId]
    );

    if (existing.rows[0]) {
      return res.json({ success: true, attempt: existing.rows[0] });
    }

    // Create new attempt
    const result = await pool.query(
      'INSERT INTO game_attempts (user_id, game_id, start_time) VALUES ($1, $2, NOW()) RETURNING *',
      [userId, gameId]
    );

    res.status(201).json({ success: true, attempt: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// 2. Submit Answer Endpoint
router.post('/:id/submit', async (req, res, next) => {
  const { id: gameId } = req.params;
  const { answer } = req.body;
  const userId = req.user.id;

  if (!answer) return res.status(400).json({ error: 'Answer is required' });

  const client = await pool.connect();
  try {
    // 1. Fetch attempt
    const attemptRes = await client.query(
      'SELECT * FROM game_attempts WHERE user_id = $1 AND game_id = $2',
      [userId, gameId]
    );
    const attempt = attemptRes.rows[0];

    if (!attempt) return res.status(404).json({ error: 'Game attempt not started' });
    if (attempt.is_completed) return res.status(400).json({ error: 'Already solved' });

    // 2. Fetch correct secret from daily_mini_games (could also be quiz_questions)
    const gameRes = await client.query('SELECT solution FROM daily_mini_games WHERE id = $1', [gameId]);
    let game = gameRes.rows[0];
    
    // Fallback to quiz_questions if not in daily_mini_games
    if (!game) {
        const quizRes = await client.query('SELECT correct_option as secret FROM quiz_questions WHERE id = $1', [gameId]);
        game = quizRes.rows[0];
    }
    
    if (!game) return res.status(404).json({ error: 'Game not found' });

    const correctSecret = typeof game.solution === 'string' ? game.solution : (game.solution?.secret || game.secret);
    
    // 3. Compare normalized strings
    if (normalizeName(answer) !== normalizeName(correctSecret)) {
      await client.query(
        'UPDATE game_attempts SET attempts_count = attempts_count + 1 WHERE id = $1',
        [attempt.id]
      );
      return res.json({ success: false, message: 'Incorrect answer' });
    }

    // 4. CORRECT - Calculate score
    const now = new Date();
    const startTime = new Date(attempt.start_time);
    const secondsElapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);

    const penalty = Math.floor(secondsElapsed / 10) * 10;
    let finalScore = 100 - penalty;
    if (finalScore < 50) finalScore = 50;

    // 5. Transaction
    await client.query('BEGIN');
    
    // Step A: Update attempt
    await client.query(
      `UPDATE game_attempts 
       SET end_time = NOW(), 
           is_completed = true, 
           score = $1, 
           time_taken_seconds = $2,
           completed_at = NOW()
       WHERE id = $3`,
      [finalScore, secondsElapsed, attempt.id]
    );

    // Step B: Reward user
    await client.query(
      'UPDATE users SET points_balance = points_balance + $1 WHERE id = $2',
      [finalScore, userId]
    );

    // Step C: Record transaction
    await client.query(
      "INSERT INTO point_transactions (user_id, amount, type, reference_id, description) VALUES ($1, $2, 'mini_game_solve', $3, 'Daily challenge reward')",
      [userId, finalScore, attempt.id]
    );

    await client.query('COMMIT');

    // 6. Analytics (LinkedIn-style)
    const statsRes = await pool.query(
      `SELECT 
         AVG(score) as avg_score,
         COUNT(*) as total_players,
         (SELECT COUNT(*) FROM game_attempts WHERE game_id = $1 AND score < $2) as players_below
       FROM game_attempts WHERE game_id = $1 AND is_completed = true`,
      [gameId, finalScore]
    );
    const { avg_score, total_players, players_below } = statsRes.rows[0];
    const percentile = total_players > 1 
      ? Math.round((parseInt(players_below) / (parseInt(total_players) - 1)) * 100)
      : 100;

    res.json({
      success: true,
      score: finalScore,
      secondsElapsed,
      attempts: attempt.attempts_count,
      stats: {
        average_score: Math.round(parseFloat(avg_score || 0)),
        total_players: parseInt(total_players || 0),
        percentile: percentile
      }
    });

  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// 3. Analytics & Statistics Endpoint (LinkedIn-Style)
router.get('/:id/stats', async (req, res, next) => {
  const { id: gameId } = req.params;
  const userId = req.user.id;

  try {
    // 1. Verify user completed the game
    const attemptCheck = await pool.query(
      'SELECT is_completed FROM game_attempts WHERE user_id = $1 AND game_id = $2',
      [userId, gameId]
    );

    if (!attemptCheck.rows[0]?.is_completed) {
      return res.status(403).json({ error: 'You must complete the game to view statistics' });
    }

    // 2. Execute optimized statistical query
    const statsQuery = `
      WITH game_stats AS (
          SELECT 
              user_id,
              score,
              attempts_count,
              EXTRACT(EPOCH FROM (end_time - start_time)) AS solve_time_seconds,
              PERCENT_RANK() OVER (ORDER BY score ASC, EXTRACT(EPOCH FROM (end_time - start_time)) DESC) as percentile_rank
          FROM game_attempts
          WHERE game_id = $1 AND is_completed = true
      ),
      global_aggregates AS (
          SELECT 
              AVG(score)::INT as avg_score,
              AVG(attempts_count)::FLOAT as avg_attempts,
              AVG(solve_time_seconds)::INT as avg_time_seconds,
              COUNT(*) as total_players
          FROM game_stats
      )
      SELECT 
          gs.score as user_score,
          gs.attempts_count as user_attempts,
          gs.solve_time_seconds as user_time,
          ROUND((gs.percentile_rank) * 100)::INT as user_top_percent,
          ga.avg_score,
          ga.avg_attempts,
          ga.avg_time_seconds,
          ga.total_players
      FROM game_stats gs
      CROSS JOIN global_aggregates ga
      WHERE gs.user_id = $2;
    `;

    const result = await pool.query(statsQuery, [gameId, userId]);
    
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Stats not found' });
    }

    res.json({ stats: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
