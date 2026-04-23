/**
 * weeklyLeaderboard.js – בונוס נקודות שבועי
 *
 * רץ שבת 21:00 UTC (ראשון 00:00 IST).
 * מעניק בונוס נקודות למובילים בכל ליגה:
 *   מקום 1: 500 נקודות
 *   מקום 2: 300 נקודות
 *   מקום 3: 100 נקודות
 * שולח התראה לזוכים.
 */
const { pool } = require('../config/database');
const { createNotification } = require('../services/notificationService');

const WEEKLY_BONUS = 1000;
const TOP_N = 5;
const RANK_EMOJI = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

// Awards 1,000 bonus points to the top 5 users on the global leaderboard.
// Runs every Sunday at 00:00 IST = Saturday 21:00 UTC.
async function sendWeeklyLeaderboardBonus() {
  if (process.env.STUB_MODE === 'true') return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Idempotency: only run once per calendar week (Sun–Sat)
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // last Sunday
    const alreadyRan = await client.query(
      `SELECT id FROM point_transactions
       WHERE type = 'weekly_bonus' AND created_at >= $1 LIMIT 1`,
      [weekStart.toISOString()]
    );
    if (alreadyRan.rows.length > 0) {
      console.log('[weeklyLeaderboard] Already distributed this week — skipping.');
      await client.query('ROLLBACK');
      return;
    }

    const top = await client.query(
      `SELECT id, username FROM users ORDER BY points_balance DESC LIMIT $1`,
      [TOP_N]
    );

    for (let i = 0; i < top.rows.length; i++) {
      const { id, username } = top.rows[i];
      const rank = i + 1;

      await client.query(
        `UPDATE users SET points_balance = points_balance + $1 WHERE id = $2`,
        [WEEKLY_BONUS, id]
      );
      await client.query(
        `INSERT INTO point_transactions (user_id, amount, type, description)
         VALUES ($1, $2, 'weekly_bonus', $3)`,
        [id, WEEKLY_BONUS, `בונוס שבועי - מקום ${rank} בלידרבורד`]
      );
      await createNotification(id, {
        type: 'weekly_bonus',
        title: `${RANK_EMOJI[i]} בונוס שבועי!`,
        body: `כל הכבוד ${username}! סיימת במקום ${rank} בלידרבורד השבועי וקיבלת ${WEEKLY_BONUS.toLocaleString()} נקודות`,
        data: { rank, bonus: WEEKLY_BONUS },
      });
    }

    await client.query('COMMIT');
    console.log(`[weeklyLeaderboard] Bonuses sent to top ${top.rows.length} users`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[weeklyLeaderboard] Error:', err.message);
  } finally {
    client.release();
  }
}

module.exports = { sendWeeklyLeaderboardBonus };
