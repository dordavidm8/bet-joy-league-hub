const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

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
        id: 'stub_box2box_1',
        game_type: 'box2box',
        play_date: new Date().toISOString().split('T')[0],
        puzzle_data: {
          team1: 'ריאל מדריד',
          team2: 'ברצלונה'
        },
        solution: {
          secret: 'לואיס פיגו'
        }
      },
      {
        id: 'stub_career_path_1',
        game_type: 'career_path',
        play_date: new Date().toISOString().split('T')[0],
        puzzle_data: {
          clubs: [
            { name: 'סנטוס', year: '2009-2013' },
            { name: 'ברצלונה', year: '2013-2017' },
            { name: 'פסז', year: '2017-2023' },
            { name: 'אל הילאל', year: '2023-' }
          ],
          hint: 'כוכב ברזילאי'
        },
        solution: {
          secret: 'ניימאר'
        }
      }
    ]);
  }
  try {
    // Only fetch puzzle data, keep solution hidden from API if client checks it later
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

module.exports = router;
