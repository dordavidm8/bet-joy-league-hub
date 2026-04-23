/**
 * adminLogService.js – audit log פעולות מנהל
 *
 * logAdminAction(adminEmail, action, entityType, entityId, details) –
 *   רושם כל פעולת מנהל ל-admin_action_log table.
 *
 * פעולות מתועדות: feature_game, cancel_bet, adjust_points,
 *   lock_game, pause_league, add_admin, toggle_competition, etc.
 *
 * מאפשר audit trail מלא: מי עשה מה ומתי.
 */
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
