const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const admin = require('../config/firebase');
const { pool } = require('../config/database');

// POST /api/auth/register
// Called after Firebase signup — creates user row in DB
router.post('/register', async (req, res, next) => {
  const { idToken, username, referralCode } = req.body;

  if (!idToken || !username) {
    return res.status(400).json({ error: 'idToken and username are required' });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);

    // Check username available
    const existing = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR firebase_uid = $2',
      [username, decoded.uid]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Username or account already exists' });
    }

    // Resolve referrer
    let referrerId = null;
    if (referralCode) {
      const ref = await pool.query(
        'SELECT id FROM users WHERE id::text LIKE $1 OR username = $1',
        [referralCode]
      );
      if (ref.rows[0]) referrerId = ref.rows[0].id;
    }

    // Create user
    const user = await pool.query(
      `INSERT INTO users (firebase_uid, username, email, points_balance, referred_by)
       VALUES ($1, $2, $3, 500, $4)
       RETURNING *`,
      [decoded.uid, username, decoded.email || '', referrerId]
    );

    // Log signup bonus
    await pool.query(
      `INSERT INTO point_transactions (user_id, amount, type, description)
       VALUES ($1, 500, 'signup', 'Welcome bonus')`,
      [user.rows[0].id]
    );

    // Award referral points if applicable
    if (referrerId) {
      await pool.query(
        'UPDATE users SET points_balance = points_balance + 1000 WHERE id = $1',
        [referrerId]
      );
      await pool.query(
        `INSERT INTO point_transactions (user_id, amount, type, reference_id, description)
         VALUES ($1, 1000, 'referral', $2, 'Referral bonus')`,
        [referrerId, user.rows[0].id]
      );
      await pool.query(
        `INSERT INTO referrals (referrer_id, referred_id, points_awarded)
         VALUES ($1, $2, 1000)`,
        [referrerId, user.rows[0].id]
      );
    }

    res.status(201).json({ user: user.rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me — returns current user profile
router.get('/me', async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }
  try {
    const decoded = await admin.auth().verifyIdToken(header.split(' ')[1]);
    const result = await pool.query(
      'SELECT * FROM users WHERE firebase_uid = $1',
      [decoded.uid]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
