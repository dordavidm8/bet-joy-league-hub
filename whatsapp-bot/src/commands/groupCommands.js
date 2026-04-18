'use strict';

const pool = require('../utils/db');
const { extractNumber } = require('../utils/phoneUtils');

// /kickoff setup <invite_code> — links an existing WA group to a Kickoff league
async function handleSetupCommand(client, msg, groupJid, inviteCode) {
  const leagueRes = await pool.query(
    `SELECT * FROM leagues WHERE invite_code = $1 AND status = 'active'`,
    [inviteCode.toUpperCase()]
  );
  const league = leagueRes.rows[0];
  if (!league) {
    await msg.reply('❌ קוד ליגה לא נמצא. בדוק שהקוד נכון ושהליגה פעילה.');
    return;
  }

  // Check that sender is the league creator
  const senderPhone = extractNumber(msg.author || msg.from);
  const creatorRes = await pool.query(
    `SELECT u.phone_number FROM users u WHERE u.id = $1`, [league.creator_id]
  );
  if (creatorRes.rows[0]?.phone_number !== senderPhone) {
    await msg.reply('❌ רק מנהל הליגה יכול לחבר את הקבוצה.');
    return;
  }

  // Register group
  await pool.query(
    `INSERT INTO wa_groups (wa_group_id, league_id) VALUES ($1,$2)
     ON CONFLICT (wa_group_id) DO UPDATE SET league_id = $2, is_active = true`,
    [groupJid, league.id]
  );
  await pool.query(`UPDATE leagues SET wa_enabled = true WHERE id = $1`, [league.id]);

  // Upsert settings with defaults
  await pool.query(
    `INSERT INTO wa_league_settings (league_id) VALUES ($1) ON CONFLICT DO NOTHING`,
    [league.id]
  );

  // Find which group members are linked to Kickoff
  const chat = await client.getChatById(groupJid);
  const participants = chat.participants || [];
  let identified = 0;

  for (const p of participants) {
    const phone = extractNumber(p.id._serialized);
    const userRes = await pool.query(
      `SELECT id FROM users WHERE phone_number = $1 AND phone_verified = true`, [phone]
    );
    if (userRes.rows[0]) identified++;
  }

  const unidentified = participants.length - identified - 1; // -1 for bot itself
  await msg.reply(
    `✅ ליגת *"${league.name}"* מחוברת!\n` +
    `חברים מזוהים: ${identified}\n` +
    `לא מזוהים: ${unidentified > 0 ? unidentified : 0} מספרים לא מקושרים לקיקאוף.`
  );
}

module.exports = { handleSetupCommand };
