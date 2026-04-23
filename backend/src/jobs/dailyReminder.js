/**
 * dailyReminder.js – תזכורת טריוויה יומית
 *
 * רץ ב-6:00 UTC (9:00 IST). שולח התראה לכל המשתמשים
 * שעדיין לא ענו על שאלת הטריוויה של היום.
 */
const { pool } = require('../config/database');
const { createNotification } = require('../services/notificationService');

// Sends daily quiz reminder to users who haven't answered today's quiz yet.
// Runs at 09:00 IST = 06:00 UTC.
async function sendDailyChallengeReminder() {
  if (process.env.STUB_MODE === 'true') return;
  try {
    const usersRes = await pool.query(
      `SELECT DISTINCT u.id FROM users u
       WHERE NOT EXISTS (
         SELECT 1 FROM quiz_attempts qa
         WHERE qa.user_id = u.id
           AND qa.answered_at >= CURRENT_DATE
       )`
    );
    console.log(`[dailyReminder] Sending to ${usersRes.rows.length} users`);
    for (const { id } of usersRes.rows) {
      await createNotification(id, {
        type: 'daily_challenge',
        title: '⚽ האתגר היומי מחכה לך!',
        body: 'ענה על שאלת הטריוויה היומית וצבור נקודות',
      });
    }
  } catch (err) {
    console.error('[dailyReminder] Error:', err.message);
  }
}

module.exports = { sendDailyChallengeReminder };
