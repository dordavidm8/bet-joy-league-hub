const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

// All routes here require authentication + admin role
router.use(authenticate, requireAdmin);

// ── 1. GET /api/admin/games ────────────────────────────────────────────────
// List all daily mini-games (admin view — includes secret/solution columns)
// ?status=pending|approved|published  (optional filter)
router.get('/games', async (req, res, next) => {
  const { status } = req.query;
  try {
    let query = `
      SELECT 
        id, game_type, play_date, status,
        puzzle_data,
        solution,          -- full solution including secret answer
        created_at
      FROM daily_mini_games
    `;
    const params = [];
    if (status) {
      query += ' WHERE status = $1';
      params.push(status);
    }
    query += ' ORDER BY play_date DESC LIMIT 100';

    const result = await pool.query(query, params);
    res.json({ games: result.rows });
  } catch (err) {
    next(err);
  }
});

// ── 2. GET /api/admin/games/:id ───────────────────────────────────────────
// Fetch a single game by ID (full data, incl. secret)
router.get('/games/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT * FROM daily_mini_games WHERE id = $1',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Game not found' });
    res.json({ game: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ── 3. PUT /api/admin/games/:id/status ────────────────────────────────────
// Approve / Publish a game — changes state so the public endpoint serves it
// Body: { "status": "published" }  (enum: pending | approved | published)
router.put('/games/:id/status', async (req, res, next) => {
  const { status } = req.body;
  const VALID_STATUSES = ['pending', 'approved', 'published'];
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }
  try {
    const result = await pool.query(
      'UPDATE daily_mini_games SET status = $1 WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Game not found' });
    res.json({ game: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ── 4. PUT /api/admin/games/:id ───────────────────────────────────────────
// Edit game puzzle data and/or secret manually (fix typos, tweak hints)
// Body: { "puzzle_data": {...}, "secret": "Corrected Answer" }
router.put('/games/:id', async (req, res, next) => {
  const { puzzle_data, secret, status, play_date } = req.body;
  try {
    // Build a merged solution object if a secret override is provided
    const existingResult = await pool.query(
      'SELECT solution FROM daily_mini_games WHERE id = $1',
      [req.params.id]
    );
    if (!existingResult.rows[0]) return res.status(404).json({ error: 'Game not found' });

    let newSolution = existingResult.rows[0].solution;
    if (secret !== undefined) {
      newSolution = { ...newSolution, secret };
    }

    const result = await pool.query(
      `UPDATE daily_mini_games
       SET puzzle_data = COALESCE($1::jsonb, puzzle_data),
           solution    = $2::jsonb,
           status      = COALESCE($3, status),
           play_date   = COALESCE($4, play_date)
       WHERE id = $5
       RETURNING *`,
      [
        puzzle_data ? JSON.stringify(puzzle_data) : null,
        JSON.stringify(newSolution),
        status || null,
        play_date || null,
        req.params.id
      ]
    );
    res.json({ game: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ── 5. POST /api/admin/games/generate ────────────────────────────────────
// Force-generate a specific game type on demand (don't wait for the cron job)
// Body: { "game_type": "missing_xi", "play_date": "2026-03-26" }  (play_date is optional)
// NOTE: This route is registered BEFORE /:id to avoid the router capturing "generate" as an id
router.post('/games/generate', async (req, res, next) => {
  const { game_type, play_date } = req.body;

  // Per-type dispatcher — import directly so we aren't coupled to generateAll
  const GENERATORS = {
    missing_xi: 'generateMissingXI',
    who_are_ya: 'generateWhoAreYa',
    career_path: 'generateCareerPath',
    box2box: 'generateBox2Box',
    guess_club: 'generateGuessClub',
  };

  try {
    let gameData;

    if (game_type && GENERATORS[game_type]) {
      // Dynamically import the specific generator function
      const generatorModule = require('../jobs/generateMiniGames');
      const fn = generatorModule[GENERATORS[game_type]];
      if (!fn) {
        return res.status(400).json({ error: `Generator for '${game_type}' is not exported from generateMiniGames.js` });
      }
      gameData = await fn();
    } else {
      // Fall back to generating all types (existing behaviour)
      const { generateAllMiniGames } = require('../jobs/generateMiniGames');
      await generateAllMiniGames();
      return res.json({ success: true, message: 'All game types generated with status=pending' });
    }

    // Insert with status 'pending' so admin can review before publishing
    const targetDate = play_date || new Date().toISOString().split('T')[0];
    const insertResult = await pool.query(
      `INSERT INTO daily_mini_games (game_type, play_date, puzzle_data, solution, status)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, 'pending')
       ON CONFLICT (game_type, play_date) DO UPDATE
         SET puzzle_data = EXCLUDED.puzzle_data,
             solution    = EXCLUDED.solution,
             status      = 'pending'
       RETURNING *`,
      [
        gameData.game_type,
        targetDate,
        JSON.stringify(gameData.puzzle_data),
        JSON.stringify(gameData.solution)
      ]
    );

    res.json({ success: true, game: insertResult.rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
