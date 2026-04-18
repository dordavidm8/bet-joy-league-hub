'use strict';

const pool = require('../utils/db');
const { buildLeaderboardMessage } = require('../utils/formatters');

async function sendScheduledLeaderboards(client, timeStr, dayOfWeek) {
  const leaguesRes = await pool.query(
    `SELECT wls.*, wg.wa_group_id, l.name AS league_name
     FROM wa_league_settings wls
     JOIN wa_groups wg ON wg.league_id = wls.league_id AND wg.is_active = true
     JOIN leagues l ON l.id = wls.league_id
     WHERE
       (wls.leaderboard_frequency = 'daily' AND wls.leaderboard_time::TEXT = $1)
       OR
       (wls.leaderboard_frequency = 'weekly' AND wls.leaderboard_day = $2 AND wls.leaderboard_time::TEXT = $1)`,
    [timeStr, dayOfWeek]
  );

  for (const row of leaguesRes.rows) {
    try {
      const members = await pool.query(
        `SELECT u.username, lm.points_in_league
         FROM league_members lm JOIN users u ON u.id = lm.user_id
         WHERE lm.league_id = $1 AND lm.is_active = true ORDER BY lm.points_in_league DESC`,
        [row.league_id]
      );
      const text = buildLeaderboardMessage(members.rows, row.league_name);
      await client.sendMessage(row.wa_group_id, text);
    } catch (err) {
      console.error('[WA] leaderboard send error:', err.message);
    }
  }
}

module.exports = { sendScheduledLeaderboards };
