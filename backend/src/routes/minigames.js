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
  'wolverhampton wanderers': ['wolves', 'וולבס', 'וולברהמפטון'],
  'manchester united': ['man utd', 'man united', 'מנצסטר יונייטד', 'מנצסתר', 'יונייטד', 'מנצ׳סטר יונייטד'],
  'manchester city': ['man city', 'מנצסטר סיטי', 'סיטי', 'מנצ׳סטר סיטי'],
  'tottenham hotspur': ['tottenham', 'spurs', 'טוטנהאם', 'ספרס'],
  'newcastle united': ['newcastle', 'newcastle utd', 'ניוקאסל'],
  'leicester city': ['leicester', 'לסטר'],
  'leeds united': ['leeds', 'לידס'],
  'nottingham forest': ['nottingham', 'נוטינגהאם'],
  'aston villa': ['villa', 'אסטון וילה', 'וילה'],
  'west ham united': ['west ham', 'ווסטהאם', 'ווסט האם'],
  'crystal palace': ['palace', 'קריסטל פאלאס', 'פאלאס'],
  'paris saint germain': ['psg', 'paris sg', 'פריז', 'פסז', 'פ.ס.ז', 'פריז סן זרמן', "פ.ס.ז'"],
  'inter milan': ['inter', 'internazionale', 'אינטר', 'אינטר מילאנו', 'אינטרנציונאלה'],
  'ac milan': ['milan', 'מילאן', 'איי סי מילאן'],
  'juventus': ['juve', 'יובנטוס', 'יובה'],
  'bayern munich': ['bayern', 'באיירן מינכן', 'באיירן'],
  'borussia dortmund': ['dortmund', 'bvb', 'דורטמונד', 'בורוסיה דורטמונד'],
  'bayer leverkusen': ['leverkusen', 'לברקוזן', 'באייר לברקוזן'],
  'real madrid': ['real', 'ריאל מדריד', 'ריאל'],
  'atletico madrid': ['atletico', 'אתלטיקו מדריד', 'אתלטיקו'],
  'barcelona': ['barca', 'ברצלונה', 'בארסה'],
  'arsenal': ['ארסנל'],
  'chelsea': ['צ׳לסי', 'צלסי'],
  'liverpool': ['ליברפול'],
};

function matchesClub(guess, secret) {
  const g = normalize(guess);
  const s = normalize(secret);
  if (g === s) return true;
  if (g.length >= 3 && s.includes(g)) return true;
  const aliases = CLUB_ALIASES[s] || [];
  return aliases.includes(g);
}

// GET /api/minigames/status?puzzle_ids=id1,id2
router.get('/status', authenticate, async (req, res, next) => {
  const user_id = req.user.id;
  const ids = (req.query.puzzle_ids || '').split(',').filter(Boolean);
  if (ids.length === 0) return res.json({ statuses: {} });
  try {
    const result = await pool.query(
      'SELECT puzzle_id, is_correct, COALESCE(attempt_count, 1) AS attempt_count FROM mini_game_attempts WHERE user_id = $1 AND puzzle_id = ANY($2::uuid[])',
      [user_id, ids]
    );
    const statuses = {};
    for (const row of result.rows) {
      statuses[row.puzzle_id] = { is_completed: row.is_correct, attempt_count: row.attempt_count };
    }
    res.json({ statuses });
  } catch (error) { next(error); }
});

const MAX_ATTEMPTS = 3;

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
    const correct_en = solution.secret;
    const correct_he = solution.secret_he;

    // 2. Check existing attempt record
    const existing = await pool.query(
      'SELECT is_correct, COALESCE(attempt_count, 1) AS attempt_count FROM mini_game_attempts WHERE user_id = $1 AND puzzle_id = $2',
      [user_id, puzzle_id]
    );
    const existingRow = existing.rows[0];

    if (existingRow?.is_correct) {
      return res.json({ success: true, is_correct: true, points_added: 0, attempt_count: existingRow.attempt_count, show_answer: true });
    }
    if (existingRow && existingRow.attempt_count >= MAX_ATTEMPTS) {
      return res.json({ 
        success: false, 
        is_correct: false, 
        points_added: 0, 
        attempt_count: existingRow.attempt_count, 
        show_answer: true, 
        correct_answer: correct_he ? `${correct_en} (${correct_he})` : correct_en 
      });
    }

    // 3. Validate guess server-side (Check both EN and HE)
    let is_correct = false;
    if (game_type === 'trivia') {
      is_correct = String(guess).startsWith(correct_en) || (correct_he && String(guess).startsWith(correct_he));
    } else if (game_type === 'box2box') {
      if (matchesName(guess, correct_en) || (correct_he && matchesName(guess, correct_he))) {
        is_correct = true;
      } else {
        const { verifyBox2Box } = require('../services/aiAdminService');
        is_correct = await verifyBox2Box(puzzle_data.team1, puzzle_data.team2, String(guess));
      }
    } else if (game_type === 'guess_club') {
      is_correct = matchesClub(guess, correct_en) || (correct_he && matchesClub(guess, correct_he));
    } else {
      is_correct = matchesName(guess, correct_en) || (correct_he && matchesName(guess, correct_he));
    }

    const pointsToAward = is_correct ? 500 : 0;
    const newAttemptCount = (existingRow?.attempt_count ?? 0) + 1;
    const showAnswer = is_correct || newAttemptCount >= MAX_ATTEMPTS;
    const displayAnswer = correct_he ? `${correct_en} (${correct_he})` : correct_en;

    // 4. Upsert attempt with incremented count
    await pool.query(
      `INSERT INTO mini_game_attempts (user_id, puzzle_id, is_correct, points_earned, attempt_count)
       VALUES ($1, $2, $3, $4, 1)
       ON CONFLICT (user_id, puzzle_id) DO UPDATE SET
         is_correct = EXCLUDED.is_correct,
         points_earned = GREATEST(mini_game_attempts.points_earned, EXCLUDED.points_earned),
         attempt_count = mini_game_attempts.attempt_count + 1`,
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

    res.json({
      success: true,
      is_correct,
      points_added: pointsToAward,
      attempt_count: newAttemptCount,
      show_answer: showAnswer,
      correct_answer: showAnswer ? displayAnswer : undefined,
    });
  } catch (error) {
    console.error('[MiniGameSubmit] Error:', error);
    next(error);
  }
});

module.exports = router;
