/**
 * routes/games.js – routes משחקים
 *
 * Endpoints:
 *   GET /games                   – רשימת משחקים (פילטור: status, date, competition, featured)
 *   GET /games/live              – משחקים חיים בלבד
 *   GET /games/results           – משחקים שהסתיימו
 *   GET /games/:id               – פרטי משחק + שאלות הימור
 *   GET /games/team-translations – תרגומי שמות קבוצות EN↔HE (מאושרים)
 *
 * נתוני משחקים מגיעים מ-ESPN API דרך syncGames cron job.
 */
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

const POPULAR_TEAMS = [
  'Manchester City', 'Man City', 'Arsenal', 'Liverpool', 'Chelsea', 'Manchester United', 'Man United', 'Tottenham', 'Tottenham Hotspur',
  'Real Madrid', 'Barcelona', 'Atlético Madrid', 'Atletico Madrid',
  'Bayern Munich', 'Borussia Dortmund', 'Dortmund',
  'Paris Saint-Germain', 'PSG',
  'Juventus', 'Inter Milan', 'Internazionale', 'AC Milan',
  'Ajax',
];

// GET /api/games
router.get('/', async (req, res, next) => {
  const { status, date, competition, search, featured, from, to } = req.query;
  const conditions = [], params = [];

  if (status) { 
    params.push(status); 
    conditions.push(`g.status = $${params.length}`); 
    if (status === 'scheduled') { 
      // Hide games starting in less than 10 minutes
      conditions.push(`g.start_time > NOW() + INTERVAL '10 minutes'`); 
    } 
  }
  if (date) { params.push(date); conditions.push(`DATE(g.start_time AT TIME ZONE 'UTC') = $${params.length}`); }
  if (from) { params.push(from); conditions.push(`g.start_time >= $${params.length}::date`); }
  if (to) { params.push(to); conditions.push(`g.start_time < ($${params.length}::date + INTERVAL '1 day')`); }
  if (competition) { params.push(`%${competition}%`); conditions.push(`c.name ILIKE $${params.length}`); }
  if (search) {
    params.push(`%${search}%`);
    const n = params.length;
    conditions.push(`(g.home_team ILIKE $${n} OR g.away_team ILIKE $${n} OR c.name ILIKE $${n})`);
  }
  if (featured === 'true') {
    // Priority: specifically marked featured OR popular team
    const teamConditions = POPULAR_TEAMS.map((_, idx) => {
      params.push(`%${POPULAR_TEAMS[idx]}%`);
      return `g.home_team ILIKE $${params.length} OR g.away_team ILIKE $${params.length}`;
    });
    conditions.push(`(g.is_featured = true OR ${teamConditions.join(' OR ')})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  try {
    const result = await pool.query(
      `SELECT g.*, c.name AS competition_name, c.logo_url AS competition_logo
       FROM games g LEFT JOIN competitions c ON c.id = g.competition_id
       ${where} ORDER BY g.start_time ASC LIMIT 100`,
      params
    );
    res.json({ games: result.rows });
  } catch (err) { next(err); }
});

// GET /api/games/results — finished games, last N days (default 7)
router.get('/results', async (req, res, next) => {
  const days = parseInt(req.query.days) || 30;
  try {
    const result = await pool.query(
      `SELECT g.*, c.name AS competition_name
       FROM games g LEFT JOIN competitions c ON c.id = g.competition_id
       WHERE g.status = 'finished'
         AND g.start_time >= NOW() - ($1 * INTERVAL '1 day')
       ORDER BY g.start_time DESC LIMIT 100`,
      [days]
    );
    res.json({ games: result.rows });
  } catch (err) { next(err); }
});

// GET /api/games/live — Returning empty as requested to hide started games
router.get('/live', async (req, res, next) => {
  try {
    // Hidden per user request: "שלא יוצגו בכלל משחקים שהתחילו"
    res.json({ games: [] });
  } catch (err) { next(err); }
});

// GET /api/games/team-translations — approved dynamic translations for frontend
router.get('/team-translations', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT name_en, name_he FROM team_name_translations WHERE status = 'approved'`
    );
    const map = {};
    result.rows.forEach(({ name_en, name_he }) => { map[name_en] = name_he; });
    res.json({ translations: map });
  } catch (err) { next(err); }
});

// GET /api/games/:id
router.get('/:id', async (req, res, next) => {
  try {
    const gameRes = await pool.query(
      `SELECT g.*, c.name AS competition_name, c.slug AS competition_slug, c.logo_url AS competition_logo
       FROM games g LEFT JOIN competitions c ON c.id = g.competition_id WHERE g.id = $1`,
      [req.params.id]
    );
    const game = gameRes.rows[0];
    if (!game) return res.status(404).json({ error: 'Game not found' });

    // Restrict access per user request: hide games that have started or are within 10 mins of kickoff.
    // Finished games remain accessible for results and history.
    const startTime = new Date(game.start_time);
    const now = new Date();
    const isTooLate = now >= new Date(startTime.getTime() - 10 * 60 * 1000);
    const isOngoing = game.status === 'live' || (game.status === 'scheduled' && isTooLate);

    if (isOngoing && game.status !== 'finished') {
       return res.status(403).json({ error: 'Access restricted: This game has already reached the betting deadline or is in progress.' });
    }

    const questionsRes = await pool.query(
      `SELECT * FROM bet_questions WHERE game_id = $1 ORDER BY created_at ASC`,
      [req.params.id]
    );
    res.json({ game: gameRes.rows[0], bet_questions: questionsRes.rows });
  } catch (err) { next(err); }
});

// GET /api/games/:id/bet-questions
router.get('/:id/bet-questions', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT * FROM bet_questions WHERE game_id = $1 ORDER BY created_at ASC`,
      [req.params.id]
    );
    res.json({ bet_questions: result.rows });
  } catch (err) { next(err); }
});

module.exports = router;
