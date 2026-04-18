'use strict';

const pool = require('../utils/db');
const { extractNumber } = require('../utils/phoneUtils');
const { getUserByPhone, processBetReply } = require('../commands/betCommands');
const { handleBalance, handleGames, handleMyBets, handleLeagues, handleHelp } = require('../commands/infoCommands');
const { isRateLimited } = require('../rateLimiter');
const stateRouter = require('../stateRouter');

async function handleDMMessage(client, msg) {
  const phone = extractNumber(msg.from);
  const content = (msg.body || '').trim();

  if (isRateLimited(msg.from)) {
    await msg.reply('⏳ יותר מדי פקודות. נסה שוב בעוד דקה.');
    return;
  }

  const user = await getUserByPhone(phone);

  // If reply to a game message, process bet
  if (msg.hasQuotedMsg) {
    const quoted = await msg.getQuotedMessage();
    const gameMsgRes = await pool.query(
      `SELECT * FROM wa_game_messages WHERE wa_message_id = $1 AND dm_phone = $2 LIMIT 1`,
      [quoted.id._serialized, phone]
    );
    if (gameMsgRes.rows[0]) {
      if (!user) {
        await msg.reply('❌ המספר שלך לא מקושר לקיקאוף. היכנס לאפליקציה ← פרופיל ← קישור WhatsApp');
        return;
      }
      await processBetReply(client, msg, phone, user, gameMsgRes.rows[0], content, 'dm');
      return;
    }
  }

  const lower = content.toLowerCase();

  if (!user) {
    await msg.reply('👋 שלום! כדי להשתמש בבוט, קשר את מספר הטלפון שלך בקיקאוף:\nפרופיל ← קישור WhatsApp');
    return;
  }

  // Commands
  if (['/balance', 'יתרה', 'balance'].includes(lower)) {
    await handleBalance(msg, user); return;
  }
  if (['/games', 'משחקים', 'games'].includes(lower)) {
    await handleGames(msg); return;
  }
  if (['/mybets', 'הימורים', 'mybets'].includes(lower)) {
    await handleMyBets(msg, user); return;
  }
  if (['/leagues', 'ליגות', 'leagues'].includes(lower)) {
    await handleLeagues(msg, user); return;
  }
  if (['/help', 'עזרה', 'help'].includes(lower)) {
    await handleHelp(msg); return;
  }
  if (['ביטול', 'cancel', '/cancel'].includes(lower)) {
    await pool.query(
      `UPDATE wa_sessions SET state = 'idle', context = '{}' WHERE phone = $1`, [phone]
    );
    await msg.reply('✅ הפעולה בוטלה.');
    return;
  }

  // State machine for interactive /bet flow
  await stateRouter.route(client, msg, phone, user, content);
}

module.exports = { handleDMMessage };
