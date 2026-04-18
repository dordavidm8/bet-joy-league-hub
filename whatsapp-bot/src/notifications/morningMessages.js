'use strict';

const pool = require('../utils/db');
const { buildGameMessage } = require('../utils/formatters');

async function sendMorningMessages(client, league) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().slice(0, 10);

  let gamesQuery;
  if (league.tournament_slug) {
    gamesQuery = await pool.query(
      `SELECT g.* FROM games g
       JOIN competitions c ON c.id = g.competition_id
       WHERE c.slug = $1 AND DATE(g.start_time) = $2 AND g.status = 'scheduled'
       ORDER BY g.start_time`,
      [league.tournament_slug, dateStr]
    );
  } else {
    gamesQuery = await pool.query(
      `SELECT * FROM games WHERE DATE(start_time) = $1 AND status = 'scheduled' ORDER BY start_time`,
      [dateStr]
    );
  }

  const settings = await pool.query(
    `SELECT * FROM wa_league_settings WHERE league_id = $1`, [league.league_id]
  );
  const wls = settings.rows[0];

  for (const game of gamesQuery.rows) {
    const text = buildGameMessage(game, wls);

    // Send to group
    if (league.wa_group_id) {
      try {
        const groupMsg = await client.sendMessage(league.wa_group_id, text);
        await pool.query(
          `INSERT INTO wa_game_messages (league_id, game_id, wa_message_id, group_jid)
           VALUES ($1,$2,$3,$4) ON CONFLICT (wa_message_id) DO NOTHING`,
          [league.league_id, game.id, groupMsg.id._serialized, league.wa_group_id]
        );
      } catch (err) {
        console.error('[WA] Group send failed:', err.message);
      }
    }

    // Send DMs to opted-in members
    const members = await pool.query(
      `SELECT u.phone_number
       FROM league_members lm JOIN users u ON u.id = lm.user_id
       WHERE lm.league_id = $1 AND u.phone_verified = true AND u.wa_opt_in = true AND lm.is_active = true`,
      [league.league_id]
    );

    for (const member of members.rows) {
      try {
        const dmMsg = await client.sendMessage(`${member.phone_number}@c.us`, text);
        await pool.query(
          `INSERT INTO wa_game_messages (league_id, game_id, wa_message_id, dm_phone)
           VALUES ($1,$2,$3,$4) ON CONFLICT (wa_message_id) DO NOTHING`,
          [league.league_id, game.id, dmMsg.id._serialized, member.phone_number]
        );
      } catch (_) {}
    }
  }
}

module.exports = { sendMorningMessages };
