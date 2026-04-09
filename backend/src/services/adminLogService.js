const { pool } = require('../config/database');

async function logAdminAction(adminEmail, action, entityType, entityId, details) {
  if (process.env.STUB_MODE === 'true') return;
  try {
    await pool.query(
      `INSERT INTO admin_action_log (admin_email, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [adminEmail, action, entityType || null, entityId || null, details ? JSON.stringify(details) : null]
    );
  } catch (err) {
    console.error('[adminLog] Failed to log action:', err.message);
  }
}

module.exports = { logAdminAction };
