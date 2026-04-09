const { pool } = require('../config/database');

async function createNotification(userId, { type, title, body, data }) {
  if (process.env.STUB_MODE === 'true') return;
  try {
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, data)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, type, title, body || null, data ? JSON.stringify(data) : null]
    );
  } catch (err) {
    console.error('[notifications] Failed to create notification:', err.message);
  }
}

module.exports = { createNotification };
