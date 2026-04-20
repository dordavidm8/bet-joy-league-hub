'use strict';

const { pool } = require('../utils/db');

async function sendReminders(client) {
  // Find all leagues with reminder configured
  const leaguesRes = await pool.query(
    `SELECT wls.league_id, wls.reminder_hours_before, wg.wa_group_id
     FROM wa_league_settings wls
     JOIN wa_groups wg ON wg.league_id = wls.league_id AND wg.is_active = true
     WHERE wls.reminder_hours_before IS NOT NULL`
  );

  for (const league of leaguesRes.rows) {
    const hoursAhead = parseFloat(league.reminder_hours_before);
    const windowStart = new Date(Date.now() + hoursAhead * 3600 * 1000 - 5 * 60 * 1000);
    const windowEnd   = new Date(Date.now() + hoursAhead * 3600 * 1000 + 5 * 60 * 1000);

    // Games starting around the reminder window
    const gamesRes = await pool.query(
      `SELECT g.id, g.home_team, g.away_team
       FROM games g
       WHERE g.status = 'scheduled'
         AND g.start_time BETWEEN $1 AND $2`,
      [windowStart.toISOString(), windowEnd.toISOString()]
    );

    for (const game of gamesRes.rows) {
      // Already sent a reminder for this game+league?
      const sentRes = await pool.query(
        `SELECT 1 FROM wa_reminders_sent WHERE league_id = $1 AND game_id = $2`,
        [league.league_id, game.id]
      );
      if (sentRes.rows.length > 0) continue;

      // Who hasn't bet yet?
      const nonBettorsRes = await pool.query(
        `SELECT u.phone_number, u.username
         FROM league_members lm
         JOIN users u ON u.id = lm.user_id
         WHERE lm.league_id = $1 AND lm.is_active = true
           AND u.phone_verified = true
           AND NOT EXISTS (
             SELECT 1 FROM bets b
             JOIN bet_questions bq ON bq.id = b.bet_question_id
             WHERE b.user_id = u.id AND bq.game_id = $2
               AND b.status = 'pending' AND b.wa_bet = true
           )`,
        [league.league_id, game.id]
      );

      if (nonBettorsRes.rows.length === 0) continue;

      const mentions = nonBettorsRes.rows.map(u => `@${u.phone_number}`).join(' ');
      const text =
        `⏰ *תזכורת!* ההימור על *${game.home_team} נגד ${game.away_team}* נסגר בעוד ${hoursAhead} שעות.\n` +
        `${mentions} — עוד לא הימרתם! השיבו להודעת המשחק 🎯`;

      await client.sendMessage(league.wa_group_id, text);

      await pool.query(
        `INSERT INTO wa_reminders_sent (league_id, game_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [league.league_id, game.id]
      );
    }
  }
}

module.exports = { sendReminders };
