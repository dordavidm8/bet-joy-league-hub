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
      }
    ]);
  }
  try {
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

// POST /api/minigames/box2box/verify
router.post('/box2box/verify', async (req, res, next) => {
  const { team1, team2, guess } = req.body;
  if (!team1 || !team2 || !guess) return res.status(400).json({ error: 'Missing parameters' });
  try {
    const { verifyBox2Box } = require('../services/aiAdminService');
    const isValid = await verifyBox2Box(team1, team2, guess);
    res.json({ valid: isValid });
  } catch (error) {
    next(error);
  }
});

// Normalizes a string for fuzzy comparison
function normalize(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\bjr\.?\b/g, 'junior')
    .replace(/\bsr\.?\b/g, 'senior')
    .trim();
}

// Fuzzy player-name match (same logic as frontend components)
function matchesName(guess, secret) {
  const g = normalize(guess);
  const s = normalize(secret);
  if (g === s) return true;
  const gWords = g.split(/\s+/).filter(w => w.length >= 3);
  const sWords = s.split(/\s+/);
  if (gWords.length > 0 && gWords.every(gw => sWords.some(sw => sw === gw || sw.startsWith(gw)))) return true;
  if (gWords.length === 1 && gWords[0].length >= 4 && sWords.some(w => w === gWords[0])) return true;
  return false;
}

const CLUB_ALIASES = {
  'wolverhampton wanderers': ['wolves'],
  'manchester united': ['man utd', 'man united'],
  'manchester city': ['man city'],
  'tottenham hotspur': ['tottenham', 'spurs'],
  'newcastle united': ['newcastle', 'newcastle utd'],
  'leicester city': ['leicester'],
  'leeds united': ['leeds'],
  'nottingham forest': ['nottingham'],
  'aston villa': ['villa'],
  'west ham united': ['west ham'],
  'crystal palace': ['palace'],
  'paris saint germain': ['psg', 'paris sg'],
  'inter milan': ['inter', 'internazionale'],
  'ac milan': ['milan'],
  'juventus': ['juve'],
  'bayern munich': ['bayern'],
  'borussia dortmund': ['dortmund', 'bvb'],
  'bayer leverkusen': ['leverkusen'],
  'real madrid': ['real'],
  'atletico madrid': ['atletico'],
  'barcelona': ['barca'],
};

function matchesClub(guess, secret) {
  const g = normalize(guess);
  const s = normalize(secret);
  if (g === s) return true;
  if (g.length >= 3 && s.includes(g)) return true;
  const aliases = CLUB_ALIASES[s] || [];
  return aliases.includes(g);
}

// POST /api/minigames/submit
router.post('/submit', authenticate, async (req, res, next) => {
  const { puzzle_id, guess } = req.body;
  const user_id = req.user.id;

  if (!puzzle_id || guess === undefined || guess === null || String(guess).trim() === '') {
    return res.status(400).json({ error: 'Missing puzzle_id or guess' });
  }

  try {
    // 1. Fetch puzzle (includes solution for server-side validation)
    const puzzleResult = await pool.query(
      'SELECT game_type, puzzle_data, solution FROM daily_mini_games WHERE id = $1',
      [puzzle_id]
    );
    if (puzzleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Puzzle not found' });
    }
    const { game_type, puzzle_data, solution } = puzzleResult.rows[0];
    const correct_answer = solution.secret;

    // 2. Check if already solved correctly
    const check = await pool.query(
      'SELECT * FROM mini_game_attempts WHERE user_id = $1 AND puzzle_id = $2 AND is_correct = true',
      [user_id, puzzle_id]
    );
    if (check.rows.length > 0) {
      return res.json({ success: true, is_correct: true, points_added: 0, correct_answer });
    }

    // 3. Validate guess server-side
    let is_correct = false;
    if (game_type === 'trivia') {
      is_correct = String(guess).startsWith(correct_answer);
    } else if (game_type === 'box2box') {
      if (matchesName(guess, correct_answer)) {
        is_correct = true;
      } else {
        const { verifyBox2Box } = require('../services/aiAdminService');
        is_correct = await verifyBox2Box(puzzle_data.team1, puzzle_data.team2, String(guess));
      }
    } else if (game_type === 'guess_club') {
      is_correct = matchesClub(guess, correct_answer);
    } else {
      // who_are_ya, career_path, missing_xi
      is_correct = matchesName(guess, correct_answer);
    }

    const pointsToAward = is_correct ? 500 : 0;

    // 4. Insert attempt
    await pool.query(
      'INSERT INTO mini_game_attempts (user_id, puzzle_id, is_correct, points_earned) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, puzzle_id) DO UPDATE SET is_correct = EXCLUDED.is_correct, points_earned = EXCLUDED.points_earned, created_at = CURRENT_TIMESTAMP',
      [user_id, puzzle_id, is_correct, pointsToAward]
    );

    // 5. Award points if correct
    if (is_correct) {
      await pool.query(
        'UPDATE users SET points_balance = points_balance + $1 WHERE id = $2',
        [pointsToAward, user_id]
      );
      await pool.query(
        'INSERT INTO point_transactions (user_id, amount, type, description, reference_id) VALUES ($1, $2, $3, $4, $5)',
        [user_id, pointsToAward, 'minigame_reward', 'Daily Mini Game Reward', puzzle_id]
      );
    }

    res.json({ success: true, is_correct, points_added: pointsToAward, correct_answer });
  } catch (error) {
    console.error('[MiniGameSubmit] Error:', error);
    next(error);
  }
});

module.exports = router;
