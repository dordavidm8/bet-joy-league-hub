const admin = require('../config/firebase');
const { pool } = require('../config/database');

async function authenticate(req, res, next) {
  // Stub mode — inject demo user from shared mutable STUB_USER
  if (process.env.STUB_MODE === 'true') {
    const { stubPool } = require('../config/stubDb');
    req.user = await stubPool.query('SELECT * FROM users WHERE id = $1', ['aaaaaaaa-0000-0000-0000-000000000001']).then(r => r.rows[0]);
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
