'use strict';

const pool = require('../utils/db');
const { extractNumber } = require('../utils/phoneUtils');
const { getUserByPhone, processBetReply } = require('../commands/betCommands');
const { handleSetupCommand } = require('../commands/groupCommands');
const { isRateLimited } = require('../rateLimiter');

async function handleGroupMessage(client, msg) {
  const groupJid = msg.from;
  const senderJid = msg.author;
  if (!senderJid) return;

  const phone = extractNumber(senderJid);
  const content = (msg.body || '').trim();

  if (isRateLimited(senderJid)) return;

  // /kickoff setup <code>
  if (content.startsWith('/kickoff setup ')) {
    const code = content.split(' ')[2];
    if (code) await handleSetupCommand(client, msg, groupJid, code);
    return;
  }

  // Check this group is a registered Kickoff group
  const groupRes = await pool.query(
    `SELECT * FROM wa_groups WHERE wa_group_id = $1 AND is_active = true LIMIT 1`,
    [groupJid]
  );
  if (!groupRes.rows[0]) return;

  // Only process replies to a bot game message
  if (!msg.hasQuotedMsg) return;
  const quoted = await msg.getQuotedMessage();
  const quotedId = quoted.id._serialized;

  const gameMsgRes = await pool.query(
    `SELECT * FROM wa_game_messages WHERE wa_message_id = $1 LIMIT 1`,
    [quotedId]
  );
  if (!gameMsgRes.rows[0]) return;

  const user = await getUserByPhone(phone);
  if (!user) return; // Unlinked — silently ignore in group

  await processBetReply(client, msg, phone, user, gameMsgRes.rows[0], content, 'group');
}

module.exports = { handleGroupMessage };
