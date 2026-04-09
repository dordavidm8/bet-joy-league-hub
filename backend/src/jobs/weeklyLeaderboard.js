const { pool } = require('../config/database');
const { createNotification } = require('../services/notificationService');

const WEEKLY_BONUS = 1000;
const TOP_N = 5;
const RANK_EMOJI = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

// Awards 1,000 bonus points to the top 5 users on the global leaderboard.
// Runs every Sunday at 00:00 IST = Saturday 21:00 UTC.
async function sendWeeklyLeaderboardBonus() {
  if (process.env.STUB_MODE === 'true') return;
  try {
    const top = await pool.query(
      `SELECT id, username FROM users ORDER BY points_balance DESC LIMIT $1`,
      [TOP_N]
    );

    for (let i = 0; i < top.rows.length; i++) {
      const { id, username } = top.rows[i];
      const rank = i + 1;

      await pool.query(
        `UPDATE users SET points_balance = points_balance + $1 WHERE id = $2`,
        [WEEKLY_BONUS, id]
      );
      await pool.query(
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

    console.log(`[weeklyLeaderboard] Bonuses sent to top ${top.rows.length} users`);
  } catch (err) {
    console.error('[weeklyLeaderboard] Error:', err.message);
  }
}

module.exports = { sendWeeklyLeaderboardBonus };
