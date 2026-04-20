const express = require('express');
const router = express.Router();
const admin = require('../config/firebase');
const { pool } = require('../config/database');

// POST /api/auth/register — called after Firebase signup
router.post('/register', async (req, res, next) => {
  const { username: rawUsername, display_name, referral_code: referralCode, avatar_url } = req.body;
  if (!rawUsername) return res.status(400).json({ error: 'username required' });
  
  // Auto-sanitize username: ensure only English letters, numbers, and basic symbols, no spaces, all lowercase.
  const username = rawUsername.replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase() || `user_${Math.random().toString(36).slice(-4)}`;

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });

  try {
    const decoded = await admin.auth().verifyIdToken(header.split(' ')[1]);

    const existing = await pool.query(
      'SELECT username, firebase_uid, email FROM users WHERE username = $1 OR firebase_uid = $2 OR (email = $3 AND email != \'\')',
      [username, decoded.uid, decoded.email || '']
    );

    if (existing.rows.some(r => r.firebase_uid === decoded.uid || (r.email === decoded.email && r.email !== ''))) {
      return res.status(409).json({ error: 'Account already exists' });
    }

    let finalUsername = username;
    if (existing.rows.some(r => r.username === username)) {
      // Username conflict — find a unique one
      let isTaken = true;
      while (isTaken) {
        // Randomly pick 1, 2, or 3 digits for the suffix
        const digitCount = Math.floor(Math.random() * 3) + 1;
        const min = Math.pow(10, digitCount - 1);
        const max = Math.pow(10, digitCount) - 1;
        const suffix = Math.floor(Math.random() * (max - min + 1)) + min;
        
        finalUsername = `${username}${suffix}`;
        const check = await pool.query('SELECT id FROM users WHERE username = $1', [finalUsername]);
        if (check.rows.length === 0) isTaken = false;
      }
    }

    // Resolve referrer
    let referrerId = null;
    if (referralCode) {
      const ref = await pool.query('SELECT id FROM users WHERE id::text = $1 OR username = $1', [referralCode]);
      if (ref.rows[0]) referrerId = ref.rows[0].id;
    }

    const resolvedAvatar = avatar_url || decoded.picture || null;

    const resolvedDisplayName = display_name?.trim() || decoded.name || username;

    const userRes = await pool.query(
      `INSERT INTO users (firebase_uid, username, display_name, email, avatar_url, points_balance, referred_by)
       VALUES ($1, $2, $3, $4, $5, 5000, $6) RETURNING *`,
      [decoded.uid, finalUsername, resolvedDisplayName, decoded.email || '', resolvedAvatar, referrerId]
    );
    const user = userRes.rows[0];

    await pool.query(
      `INSERT INTO point_transactions (user_id, amount, type, description) VALUES ($1, 5000, 'signup', 'Welcome bonus')`,
      [user.id]
    );

    if (referrerId) {
      // Bonus for referrer
      await pool.query('UPDATE users SET points_balance = points_balance + 1000 WHERE id = $1', [referrerId]);
      await pool.query(
        `INSERT INTO point_transactions (user_id, amount, type, reference_id, description) VALUES ($1, 1000, 'referral_earned', $2, 'Referral bonus (new user joined)')`,
        [referrerId, user.id]
      );
      await pool.query(
        `INSERT INTO referrals (referrer_id, referred_id, points_awarded) VALUES ($1, $2, 1000)`,
        [referrerId, user.id]
      );

      // Bonus for referred user (the new user)
      await pool.query('UPDATE users SET points_balance = points_balance + 1000 WHERE id = $1', [user.id]);
      await pool.query(
        `INSERT INTO point_transactions (user_id, amount, type, description) VALUES ($1, 1000, 'referral_bonus', 'Referral sign-up bonus')`,
        [user.id]
      );
    }

    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', async (req, res, next) => {
  // In stub mode, always return the demo user
  if (process.env.STUB_MODE === 'true') {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', ['aaaaaaaa-0000-0000-0000-000000000001']);
    return res.json({ user: result.rows[0] });
  }

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });

  try {
    const decoded = await admin.auth().verifyIdToken(header.split(' ')[1]);
    const result = await pool.query('SELECT * FROM users WHERE firebase_uid = $1', [decoded.uid]);
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
