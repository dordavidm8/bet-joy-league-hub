const admin = require('../config/firebase');
const { pool } = require('../config/database');

// Verifies Firebase ID token and attaches user to req
async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing auth token' });
  }

  const token = header.split(' ')[1];
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    const result = await pool.query(
      'SELECT * FROM users WHERE firebase_uid = $1',
      [decoded.uid]
    );
    if (!result.rows[0]) {
      return res.status(401).json({ error: 'User not found' });
    }
    req.user = result.rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Only allows admin users (developers)
function requireAdmin(req, res, next) {
  const adminUids = (process.env.ADMIN_UIDS || '').split(',').map((u) => u.trim());
  if (!adminUids.includes(req.user?.firebase_uid)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { authenticate, requireAdmin };
