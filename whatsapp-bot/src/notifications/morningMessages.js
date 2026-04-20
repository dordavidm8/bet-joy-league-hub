'use strict';

const { pool } = require('../utils/db');
const { buildGameMessage } = require('../utils/formatters');

async function sendMorningMessages(client, league) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStart = new Date(tomorrow.setHours(0, 0, 0, 0)).toISOString();
  const tomorrowEnd = new Date(tomorrow.setHours(23, 59, 59, 999)).toISOString();

  // Fetch games for tomorrow that belong to leagues this league cares about
  // (all games — league filtering happens through league_members / bets context)
  const gamesRes = await pool.query(
    `SELECT g.id, g.home_team, g.away_team, g.start_time
     FROM games g
     WHERE g.status = 'scheduled'
       AND g.start_time BETWEEN $1 AND $2
     ORDER BY g.start_time`,
    [tomorrowStart, tomorrowEnd]
  );

  if (gamesRes.rows.length === 0) return;

  for (const game of gamesRes.rows) {
    // Check if we already sent a message for this game+league today
    const existing = await pool.query(
      `SELECT id FROM wa_game_messages
       WHERE league_id = $1 AND game_id = $2 AND group_jid IS NOT NULL`,
      [league.league_id, game.id]
    );
    if (existing.rows.length > 0) continue;

    const text = buildGameMessage(game, league);

    // Send to group
    const groupMsg = await client.sendMessage(league.wa_group_id, text);

    // Save message ID for reply detection
    await pool.query(
      `INSERT INTO wa_game_messages (league_id, game_id, wa_message_id, group_jid, sent_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [league.league_id, game.id, groupMsg.id._serialized, league.wa_group_id]
    );

    // Send DM to all opted-in members
    await sendGameMessageToDMs(client, league, game, text);
  }
}

async function sendGameMessageToDMs(client, league, game, text) {
  const membersRes = await pool.query(
    `SELECT u.phone_number
     FROM league_members lm
     JOIN users u ON u.id = lm.user_id
     WHERE lm.league_id = $1 AND lm.is_active = true
       AND u.phone_verified = true AND u.wa_opt_in = true`,
    [league.league_id]
  );

  for (const member of membersRes.rows) {
    try {
      const jid = `${member.phone_number}@c.us`;
      const dmMsg = await client.sendMessage(jid, text);

      await pool.query(
        `INSERT INTO wa_game_messages (league_id, game_id, wa_message_id, dm_phone, sent_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [league.league_id, game.id, dmMsg.id._serialized, member.phone_number]
      );
    } catch (err) {
      console.error(`[morningMsg] DM error for ${member.phone_number}:`, err.message);
    }
  }
}

module.exports = { sendMorningMessages };
