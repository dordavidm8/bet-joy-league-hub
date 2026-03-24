const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// GET /api/minigames/today
router.get('/today', async (req, res, next) => {
  try {
    // Only fetch puzzle data, keep solution hidden from API if client checks it later
    const query = `
      SELECT id, game_type, play_date, puzzle_data
      FROM daily_mini_games
      WHERE play_date = CURRENT_DATE
    `;
    const result = await pool.query(query);
    
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
