const { pool } = require('../config/database');
const { createNotification } = require('../services/notificationService');
const { translateTeam } = require('../lib/teamNames');

// Runs every 15 minutes. Finds featured games whose notification window has arrived,
// sends a push notification to all users, and marks the game as notified.
async function sendFeaturedMatchNotifications() {
  if (process.env.STUB_MODE === 'true') return;
  try {
    // Find featured games where: not yet notified, game hasn't started,
    // and we're within the configured hours-before window
    const gamesRes = await pool.query(
      `SELECT id, home_team, away_team, start_time, featured_bonus_pct, featured_notif_hours
       FROM games
       WHERE is_featured = true
         AND featured_notif_sent = false
         AND status = 'scheduled'
         AND start_time > NOW()
         AND start_time <= NOW() + (featured_notif_hours || ' hours')::INTERVAL`
    );

    if (!gamesRes.rows.length) return;

    const usersRes = await pool.query(`SELECT id, phone_number, phone_verified, wa_opt_in FROM users`);
    const users = usersRes.rows;
    const { sendDM } = require('../services/whatsappBotService');

    for (const game of gamesRes.rows) {
      const kickoffTime = new Date(game.start_time).toLocaleTimeString('he-IL', {
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem',
      });

      for (const u of users) {
        // App notification
        await createNotification(u.id, {
          type: 'special_offer',
          title: `🔥 משחק מומלץ — ${translateTeam(game.home_team)} נגד ${translateTeam(game.away_team)}`,
          body: `בונוס של +${game.featured_bonus_pct}% על הסיכויים! המשחק מתחיל ב-${kickoffTime}`,
          data: { game_id: game.id, bonus_pct: game.featured_bonus_pct },
        });

        // WhatsApp notification
        if (u.phone_number && u.phone_verified && u.wa_opt_in) {
          const waText = 
            `🔥 *משחק מומלץ: ${translateTeam(game.home_team)} נגד ${translateTeam(game.away_team)}*\n\n` +
            `בונוס של +${game.featured_bonus_pct}% על הסיכויים! ✨\n` +
            `המשחק מתחיל ב-${kickoffTime}\n\n` +
            `להימור מהיר:\nhttps://kickoff-bet.app/game/${game.id}`;
          
          sendDM(u.phone_number, waText).catch(() => {});
        }
      }

      await pool.query(`UPDATE games SET featured_notif_sent = true WHERE id = $1`, [game.id]);
      console.log(`[featuredNotif] Sent notifications for ${game.home_team} vs ${game.away_team} (${users.length} users)`);
    }
  } catch (err) {
    console.error('[featuredNotif] Error:', err.message);
  }
}

module.exports = { sendFeaturedMatchNotifications };
