const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');

// GET /api/quiz/next
router.get('/next', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT q.* FROM quiz_questions q
       WHERE q.is_active = true
         AND q.id NOT IN (SELECT question_id FROM quiz_attempts WHERE user_id = $1)
       ORDER BY RANDOM() LIMIT 1`,
      [req.user.id]
    );
    if (!result.rows[0]) return res.json({ question: null, message: 'No more questions' });
    const { correct_option, ...safeQuestion } = result.rows[0];
    res.json({ question: safeQuestion });
  } catch (err) { next(err); }
});

// POST /api/quiz/:id/answer
router.post('/:id/answer', authenticate, async (req, res, next) => {
  const { selected_option } = req.body;
  if (!selected_option) return res.status(400).json({ error: 'selected_option required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const qRes = await client.query(`SELECT * FROM quiz_questions WHERE id = $1 AND is_active = true`, [req.params.id]);
    const question = qRes.rows[0];
    if (!question) return res.status(404).json({ error: 'Question not found' });

    const alreadyAnswered = await client.query(
      `SELECT id FROM quiz_attempts WHERE user_id = $1 AND question_id = $2`, [req.user.id, question.id]
    );
    if (alreadyAnswered.rows[0]) return res.status(409).json({ error: 'Already answered' });

    const isCorrect = selected_option === question.correct_option;
    const pointsEarned = isCorrect ? question.points_reward : 0;

    await client.query(
      `INSERT INTO quiz_attempts (user_id, question_id, selected_option, is_correct, points_earned) VALUES ($1,$2,$3,$4,$5)`,
      [req.user.id, question.id, selected_option, isCorrect, pointsEarned]
    );

    if (isCorrect) {
      await client.query(`UPDATE users SET points_balance = points_balance + $1 WHERE id = $2`, [pointsEarned, req.user.id]);
      await client.query(
        `INSERT INTO point_transactions (user_id, amount, type, reference_id, description) VALUES ($1,$2,'quiz_won',$3,'Quiz correct answer')`,
        [req.user.id, pointsEarned, question.id]
      );
    }

    await client.query('COMMIT');
    res.json({ correct: isCorrect, correct_option: question.correct_option, points_earned: pointsEarned });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

module.exports = router;
