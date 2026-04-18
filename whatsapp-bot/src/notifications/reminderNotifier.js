'use strict';

const pool = require('../utils/db');

async function sendReminders(client) {
  const leaguesRes = await pool.query(
    `SELECT wls.league_id, wls.reminder_hours_before, wg.wa_group_id
     FROM wa_league_settings wls
     JOIN wa_groups wg ON wg.league_id = wls.league_id AND wg.is_active = true
     WHERE wls.reminder_hours_before IS NOT NULL`
  );

  for (const league of leaguesRes.rows) {
    const hoursAhead = parseFloat(league.reminder_hours_before);
    const targetTime = new Date(Date.now() + hoursAhead * 3600 * 1000);
    const from = new Date(targetTime.getTime() - 5 * 60 * 1000);
    const to   = new Date(targetTime.getTime() + 5 * 60 * 1000);

    const games = await pool.query(
      `SELECT id, home_team, away_team FROM games
       WHERE start_time BETWEEN $1 AND $2 AND status = 'scheduled'`,
      [from, to]
    );

    for (const game of games.rows) {
      // Skip if reminder already sent
      const sent = await pool.query(
        `SELECT 1 FROM wa_reminders_sent WHERE league_id = $1 AND game_id = $2`,
        [league.league_id, game.id]
      );
      if (sent.rows[0]) continue;

      // Find members who haven't bet yet
      const nonBettors = await pool.query(
        `SELECT u.phone_number, u.username
         FROM league_members lm JOIN users u ON u.id = lm.user_id
         WHERE lm.league_id = $1 AND lm.is_active = true AND u.phone_verified = true
           AND NOT EXISTS (
             SELECT 1 FROM bets b
             WHERE b.user_id = lm.user_id AND b.game_id = $2 AND b.status != 'cancelled'
           )`,
        [league.league_id, game.id]
      );

      if (!nonBettors.rows.length) {
        await pool.query(`INSERT INTO wa_reminders_sent (league_id, game_id) VALUES ($1,$2)`, [league.league_id, game.id]);
        continue;
      }

      const mentions = nonBettors.rows.map(u => `@${u.phone_number}`).join(' ');
      const text = `⏰ *תזכורת!* ההימור על *${game.home_team}* נגד *${game.away_team}* נסגר בעוד ${hoursAhead} שעות.\n${mentions} — עוד לא הימרתם!`;

      try {
        await client.sendMessage(league.wa_group_id, text);
      } catch (err) {
        console.error('[WA] reminder send failed:', err.message);
      }

      await pool.query(`INSERT INTO wa_reminders_sent (league_id, game_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [league.league_id, game.id]);
    }
  }
}

module.exports = { sendReminders };
