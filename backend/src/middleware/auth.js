const admin = require('../config/firebase');
const { pool } = require('../config/database');

async function authenticate(req, res, next) {
  // Stub mode — inject demo user, no token needed
  if (process.env.STUB_MODE === 'true') {
    req.user = {
      id: 'aaaaaaaa-0000-0000-0000-000000000001',
      firebase_uid: 'stub-uid-001',
      username: 'demo',
      email: 'demo@kickoff.app',
      points_balance: 1250,
      total_bets: 18,
      total_wins: 12,
    };
    return next();
  }

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing auth token' });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(header.split(' ')[1]);
    const result = await pool.query('SELECT * FROM users WHERE firebase_uid = $1', [decoded.uid]);
    if (!result.rows[0]) return res.status(401).json({ error: 'User not registered' });
    req.user = result.rows[0];
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function requireAdmin(req, res, next) {
  const adminUids = (process.env.ADMIN_UIDS || '').split(',').map(u => u.trim()).filter(Boolean);
  if (process.env.STUB_MODE === 'true' || adminUids.includes(req.user?.firebase_uid)) {
    return next();
  }
  res.status(403).json({ error: 'Admin access required' });
}

module.exports = { authenticate, requireAdmin };
