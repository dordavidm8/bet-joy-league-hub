/**
 * notifications/morningMessages.js – הודעות בוקר
 *
 * sendMorningMessages() –
 *   שולח לכל הקבוצות המחוברות רשימת משחקי היום.
 *   כל הודעה מוצגת כ-wa_game_messages לצורך reply tracking.
 *   רץ ב-9:00 IST דרך scheduledJobs.js.
 */
'use strict';

const { pool } = require('../utils/db');
const { buildGameMessage } = require('../utils/formatters');

async function sendMorningMessages(client, league) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStart = new Date(tomorrow.setHours(0, 0, 0, 0)).toISOString();
  const tomorrowEnd = new Date(tomorrow.setHours(23, 59, 59, 999)).toISOString();

  const { translateTeam } = require('../utils/teamNames');

  let gamesQuery = `
    SELECT g.id, g.home_team, g.away_team, g.start_time,
           t1.name_he as home_he_db, t2.name_he as away_he_db,
           bq.outcomes
    FROM games g
    LEFT JOIN team_name_translations t1 ON t1.name_en = g.home_team
    LEFT JOIN team_name_translations t2 ON t2.name_en = g.away_team
    LEFT JOIN bet_questions bq ON bq.game_id = g.id AND bq.type = 'match_winner'
  `;
  const params = [tomorrowStart, tomorrowEnd];

  if (league.is_tournament && league.tournament_slug) {
    gamesQuery += `
      JOIN competitions c ON c.id = g.competition_id
      WHERE g.status = 'scheduled'
        AND g.start_time BETWEEN $1 AND $2
        AND c.slug = $3
    `;
    params.push(league.tournament_slug);
  } else {
    gamesQuery += `
      WHERE g.status = 'scheduled'
        AND g.start_time BETWEEN $1 AND $2
    `;
  }
  gamesQuery += ` ORDER BY g.start_time`;

  const gamesRes = await pool.query(gamesQuery, params);

  console.log(`[morningMsg] Found ${gamesRes.rows.length} games for league ${league.league_name}`);
  if (gamesRes.rows.length === 0) return;

  for (const game of gamesRes.rows) {
    // Add translated names to game object
    game.home_team_he = game.home_he_db || translateTeam(game.home_team);
    game.away_team_he = game.away_he_db || translateTeam(game.away_team);
    // Check if we already sent a message for this game+league today
    // const existing = await pool.query(
    //   `SELECT id FROM wa_game_messages
    //    WHERE league_id = $1 AND game_id = $2 AND group_jid IS NOT NULL`,
    //   [league.league_id_val || league.league_id, game.id]
    // );
    // if (existing.rows.length > 0) {
    //   console.log(`[morningMsg] Skipping game ${game.home_team} vs ${game.away_team} (already sent)`);
    //   continue;
    // }

    console.log(`[morningMsg] Sending game message: ${game.home_team} vs ${game.away_team}`);

    const text = buildGameMessage(game, league);

    // Send to group
    const groupMsg = await client.sendMessage(league.wa_group_id, text);

    // Save message ID for reply detection
    await pool.query(
      `INSERT INTO wa_game_messages (league_id, game_id, wa_message_id, group_jid, sent_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [league.league_id_val || league.league_id, game.id, groupMsg.id._serialized, league.wa_group_id]
    );

    // Wait a brief moment to avoid WhatsApp sending limits/issues
    await new Promise(r => setTimeout(r, 1500));
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
