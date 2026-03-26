const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { authenticate } = require('../middleware/auth');

const dbUrl = process.env.DATABASE_URL || '';
const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
const pool = new Pool({
  connectionString: dbUrl,
  ssl: !isLocal ? { rejectUnauthorized: false } : false,
});

// GET /api/minigames/today
router.get('/today', async (req, res, next) => {
  if (process.env.STUB_MODE === 'true') {
    return res.json([
      {
        id: 'aaaaaaaa-0000-0000-0000-000000000001',
        game_type: 'box2box',
        play_date: new Date().toISOString().split('T')[0],
        puzzle_data: { team1: 'ריאל מדריד', team2: 'ברצלונה' },
        solution: { secret: 'לואיס פיגו' }
      }
    ]);
  }
  try {
    const query = `
      SELECT id, game_type, play_date, puzzle_data, solution
      FROM daily_mini_games
      WHERE play_date = CURRENT_DATE
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// POST /api/minigames/submit
router.post('/submit', authenticate, async (req, res, next) => {
  const { puzzle_id, is_correct } = req.body;
  const user_id = req.user.id;

  try {
    // 1. Check if already solved correctly today
    const check = await pool.query(
      'SELECT * FROM mini_game_attempts WHERE user_id = $1 AND puzzle_id = $2 AND is_correct = true',
      [user_id, puzzle_id]
    );

    if (check.rows.length > 0) {
      return res.json({ success: true, message: 'Already earned points for this challenge today.', points_added: 0 });
    }

    const pointsToAward = is_correct ? 500 : 0;

    // 2. Insert attempt
    await pool.query(
      'INSERT INTO mini_game_attempts (user_id, puzzle_id, is_correct, points_earned) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, puzzle_id) DO UPDATE SET is_correct = EXCLUDED.is_correct, points_earned = EXCLUDED.points_earned, created_at = CURRENT_TIMESTAMP',
      [user_id, puzzle_id, is_correct, pointsToAward]
    );

    // 3. Award points if correct
    if (is_correct) {
      await pool.query(
        'UPDATE users SET points_balance = points_balance + $1 WHERE id = $2',
        [pointsToAward, user_id]
      );

      // Record transaction
      await pool.query(
        'INSERT INTO point_transactions (user_id, amount, type, description, reference_id) VALUES ($1, $2, $3, $4, $5)',
        [user_id, pointsToAward, 'minigame_reward', 'Daily Mini Game Reward', puzzle_id]
      );
    }

    res.json({ success: true, is_correct, points_added: pointsToAward });
  } catch (error) {
    console.error('[MiniGameSubmit] Error:', error);
    next(error);
  }
});

module.exports = router;
