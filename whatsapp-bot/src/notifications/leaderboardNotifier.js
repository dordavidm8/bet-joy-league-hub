'use strict';

const { pool } = require('../utils/db');
const { buildLeaderboardMessage } = require('../utils/formatters');

async function sendLeaderboard(client, league) {
  const membersRes = await pool.query(
    `SELECT u.username, lm.points_in_league
     FROM league_members lm
     JOIN users u ON u.id = lm.user_id
     WHERE lm.league_id = $1 AND lm.is_active = true
     ORDER BY lm.points_in_league DESC`,
    [league.league_id]
  );

  if (membersRes.rows.length === 0) return;

  const text = buildLeaderboardMessage(league.league_name, membersRes.rows);
  await client.sendMessage(league.wa_group_id, text);
}

module.exports = { sendLeaderboard };
