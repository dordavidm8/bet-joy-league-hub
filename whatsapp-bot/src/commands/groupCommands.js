'use strict';

const { pool } = require('../utils/db');
const { extractNumber } = require('../utils/phoneUtils');

/**
 * /kickoff setup <invite_code> — links an existing WA group to a Kickoff league
 */
async function handleSetupCommand(client, msg, chat, parts) {
  if (!chat.isGroup) {
    return msg.reply('❌ הפקודה הזו מיועדת לקבוצות בלבד.');
  }

  const groupJid = chat.id._serialized;
  const inviteCode = parts[2]?.toUpperCase();
  if (!inviteCode) {
    return msg.reply('⚠️ מבנה פקודה לא תקין. השתמש ב: `kickoff setup [קוד-ליגה]`');
  }

  // 0. Permission check: Can we send messages?
  if (chat.canSendMessages === false) {
    console.warn(`[WA] setupCommand: Bot might not have permissions to reply in ${groupJid}`);
    // If we are here, we probably received a message, so we might be able to reply.
  }

  // 1. Find league
  const leagueRes = await pool.query(
    `SELECT * FROM leagues WHERE invite_code = $1 AND status = 'active'`,
    [inviteCode]
  );
  const league = leagueRes.rows[0];

  if (!league) {
    return msg.reply(`❌ לא נמצאה ליגה פעילה עם הקוד *${inviteCode}*. וודא שהקוד נכון.`);
  }

  // Check if ALREADY connected to THIS group
  const existingRes = await pool.query(
    `SELECT * FROM wa_groups WHERE wa_group_id = $1 AND league_id = $2 AND is_active = true`,
    [groupJid, league.id]
  );
  if (existingRes.rows.length > 0) {
    return msg.reply(`✅ הקבוצה כבר מחוברת לליגה "${league.name}".`);
  }

  // 2. Link in DB
  await pool.query('UPDATE leagues SET wa_enabled = true WHERE id = $1', [league.id]);
  await pool.query(
    `INSERT INTO wa_groups (wa_group_id, league_id, is_active) VALUES ($1, $2, true)
     ON CONFLICT (wa_group_id, league_id) DO UPDATE SET is_active = true`,
    [groupJid, league.id]
  );
  await pool.query(
    `INSERT INTO wa_league_settings (league_id, bet_mode, stake_amount) VALUES ($1, 'prediction', 0)
     ON CONFLICT (league_id) DO NOTHING`,
    [league.id]
  );

  // 3. Get participants and invite link
  let identified = 0;
  let unidentified = 0;
  try {
    // Refresh chat to ensure participants are loaded
    const participants = await chat.getParticipants();
    const phones = participants.map(p => extractNumber(p.id._serialized)).filter(Boolean);
    
    if (phones.length > 0) {
      const placeholders = phones.map((_, i) => `$${i + 1}`).join(',');
      const usersRes = await pool.query(`SELECT id FROM users WHERE phone_number IN (${placeholders}) AND phone_verified = true`, phones);
      identified = usersRes.rows.length;
      unidentified = participants.length - identified - 1; // -1 for bot
    }
    console.log(`[WA] Setup: identified=${identified}, unidentified=${unidentified}, total=${participants.length}`);
  } catch (e) {
    console.error('[WA] Failed to get participants:', e.message);
  }

  let inviteLink = null;
  let adminWarning = '';
  try {
    const code = await chat.getInviteCode();
    inviteLink = `https://chat.whatsapp.com/${code}`;
    await pool.query(`UPDATE wa_groups SET invite_link = $1 WHERE wa_group_id = $2 AND league_id = $3`, [inviteLink, groupJid, league.id]);
  } catch (e) {
    console.warn(`[WA] setupCommand invite link FAIL: ${e.message}`);
    adminWarning = `\n\n⚠️ *שים לב:* הבוט אינו מנהל בקבוצה, לכן לא יכולתי לשלוף את לינק ההצטרפות באופן אוטומטי. להצגת הלינק באתר, אנא הוסף אותו ידנית בדאשבורד או הפוך את הבוט למנהל.`;
  }

  const welcomeText = `✅ ליגת *"${league.name}"* מחוברת!\n\n` +
    `חברים מזוהים: ${identified}\n` +
    `לא מזוהים: ${unidentified > 0 ? unidentified : 0} מספרים לא מקושרים לקיקאוף.\n\n` +
    `*כללי המשחק:*\n` +
    `בכל בוקר יישלחו לקבוצה הודעות על משחקי היום הבא. על מנת להמר על המשחק יש להגיב להודעה עם המנצחת (1/2/X) והתוצאה המדויקת.\n` +
    `בסיום כל משחק יישלחו התוצאות והניקוד שהרוויח כל משתתף.\n` +
    `רוצים לראות את הטבלה העדכנית? תכתבו *"שלח טבלה גבר"*.\n\n` +
    `יאללה, מי שעוד לא חיבר את המשתמש שלו לווטסאפ - זה הזמן.\n` +
    `אתר הליגה:\n` +
    `https://kickoff-bet.app/leagues/${league.id}\n\n` +
    `שיהיה בהצלחה! 🏆${adminWarning}`;

  await msg.reply(welcomeText);
}

module.exports = { handleSetupCommand };
