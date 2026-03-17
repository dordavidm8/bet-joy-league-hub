const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');

// GET /api/games — list games (filter by status, competition, date)
router.get('/', async (req, res, next) => {
  const { status, competition_id, date } = req.query;
  const conditions = [];
  const params = [];

  if (status) {
    params.push(status);
    conditions.push(`g.status = $${params.length}`);
  }
  if (competition_id) {
    params.push(competition_id);
    conditions.push(`g.competition_id = $${params.length}`);
  }
  if (date) {
    // date format: YYYY-MM-DD
    params.push(date);
    conditions.push(`DATE(g.start_time) = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const result = await pool.query(
      `SELECT g.*, c.name AS competition_name, c.logo_url AS competition_logo
       FROM games g
       LEFT JOIN competitions c ON c.id = g.competition_id
       ${where}
       ORDER BY g.start_time ASC
       LIMIT 100`,
      params
    );
    res.json({ games: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/games/live — active live games
router.get('/live', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT g.*, c.name AS competition_name
       FROM games g
       LEFT JOIN competitions c ON c.id = g.competition_id
       WHERE g.status = 'live'
       ORDER BY g.start_time ASC`
    );
    res.json({ games: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/games/:id — single game with bet questions
router.get('/:id', async (req, res, next) => {
  try {
    const gameResult = await pool.query(
      `SELECT g.*, c.name AS competition_name, c.logo_url AS competition_logo
       FROM games g
       LEFT JOIN competitions c ON c.id = g.competition_id
       WHERE g.id = $1`,
      [req.params.id]
    );
    if (!gameResult.rows[0]) return res.status(404).json({ error: 'Game not found' });

    const questionsResult = await pool.query(
      `SELECT * FROM bet_questions WHERE game_id = $1 ORDER BY created_at ASC`,
      [req.params.id]
    );

    res.json({
      game: gameResult.rows[0],
      bet_questions: questionsResult.rows,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/games/:id/bet-questions — just the bet questions
router.get('/:id/bet-questions', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT * FROM bet_questions WHERE game_id = $1 ORDER BY created_at ASC`,
      [req.params.id]
    );
    res.json({ bet_questions: result.rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
