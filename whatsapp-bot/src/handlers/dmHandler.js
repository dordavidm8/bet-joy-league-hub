'use strict';

const { pool } = require('../utils/db');
const { extractNumber } = require('../utils/phoneUtils');
const { processBetReply } = require('./groupHandler');
const { getState, setState, clearState } = require('./stateRouter');
const { formatPoints } = require('../utils/formatters');

function getHelpText() {
  return `👋 *שלום! אני הבוט של Kickoff* ⚽\n\n` +
    `*פקודות זמינות:*\n` +
    `• *יתרה* — הצג את יתרת הנקודות שלך\n` +
    `• *משחקים* — משחקים פתוחים להימורים\n` +
    `• *הימורים* — ההימורים האחרונים שלך\n` +
    `• *עזרה* — תפריט זה\n\n` +
    `כדי להמר — השב להודעת המשחק שנשלחה אליך 🎯`;
}

async function handleDmMessage(client, msg) {
  const rawPhone = extractNumber(msg.from);
  const { normalizePhone } = require('../utils/phoneUtils');
  const phone = normalizePhone(rawPhone);
  
  // Check if they are linked AT ALL
  const userRes = await pool.query(
    `SELECT id, username, points_balance FROM users WHERE phone_number = $1 AND phone_verified = true`,
    [phone]
  );
  
  const user = userRes.rows[0];
  if (!user) {
    await client.sendMessage(msg.from, `❌ אני לא מזהה את המשתמש.\n\nיש לקשר את המשתמש למספר הטלפון באתר כדי להשתמש בבוט: https://kickoff-bet.app/profile`, { linkPreview: false });
    return;
  }

  const content = msg.body.trim();

  // Check if this is a reply to a game message (DM bet)
  if (msg.hasQuotedMsg) {
    const quoted = await msg.getQuotedMessage();
    const quotedId = quoted.id._serialized;

    const gameMsgRes = await pool.query(
      `SELECT * FROM wa_game_messages WHERE wa_message_id = $1`,
      [quotedId]
    );
    if (gameMsgRes.rows[0]) {
      await processBetReply(client, msg, phone, gameMsgRes.rows[0], 'dm');
      return;
    }

    // Reply to own bet message = correction
    const prevBetRes = await pool.query(
      `SELECT b.* FROM bets b
       JOIN users u ON u.id = b.user_id
       WHERE b.wa_bet_message_id = $1 AND u.phone_number = $2`,
      [quotedId, phone]
    );
    if (prevBetRes.rows[0]) {
      const { processBetCorrection } = require('./groupHandler');
      await processBetCorrection(client, msg, phone, prevBetRes.rows[0]);
      return;
    }
  }

  // Route commands
  const cmd = content.toLowerCase();
  if (cmd === '/help' || cmd === 'עזרה' || cmd === 'תפריט') {
    await msg.reply(getHelpText());
  } else if (cmd === '/balance' || cmd === 'יתרה') {
    await sendBalance(msg, user);
  } else if (cmd === '/games' || cmd === 'משחקים') {
    await sendUpcomingGames(msg, user);
  } else if (cmd === '/mybets' || cmd === 'הימורים') {
    await sendMyBets(msg, user);
  } else if (cmd === 'ביטול' || cmd === 'cancel') {
    await clearState(phone);
    await msg.reply('✅ הפעולה בוטלה');
  } else {
    await msg.reply(`❌ לא זיהיתי את הפקודה שלך.\n\n${getHelpText()}`);
  }
}

async function sendBalance(msg, user) {
  await msg.reply(`💰 *${user.username}*, יתרתך: *${formatPoints(user.points_balance)} נקודות*`);
}

async function sendUpcomingGames(msg, user) {
  const gamesRes = await pool.query(
    `SELECT home_team, away_team, commence_time FROM games
     WHERE status = 'scheduled' AND commence_time > NOW()
     ORDER BY commence_time LIMIT 5`
  );

  if (gamesRes.rows.length === 0) {
    await msg.reply('אין משחקים פתוחים כרגע 🤷');
    return;
  }

  let text = `⚽ *משחקים פתוחים להימורים:*\n\n`;
  gamesRes.rows.forEach((g, i) => {
    const t = new Date(g.commence_time).toLocaleString('he-IL', {
      weekday: 'short', day: 'numeric', month: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem'
    });
    text += `${i + 1}. ${g.home_team} נגד ${g.away_team}\n   🗓 ${t}\n\n`;
  });
  text += `כדי להמר — השב להודעת המשחק שנשלחה אליך בבוקר 🎯`;
  await msg.reply(text);
}

async function sendMyBets(msg, user) {
  const betsRes = await pool.query(
    `SELECT b.selected_outcome, b.status, b.stake, b.actual_payout, b.potential_payout,
            g.home_team, g.away_team
     FROM bets b JOIN games g ON g.id = b.game_id
     WHERE b.user_id = $1
     ORDER BY b.created_at DESC LIMIT 5`,
    [user.id]
  );

  if (betsRes.rows.length === 0) {
    await msg.reply('עדיין אין הימורים 🤷');
    return;
  }

  let text = `🎯 *הימורים אחרונים של ${user.username}:*\n\n`;
  betsRes.rows.forEach(b => {
    const statusIcon = b.status === 'won' ? '✅' : b.status === 'lost' ? '❌' : '⏳';
    const pts = b.status === 'won' ? `+${b.actual_payout}` : b.status === 'lost' ? `-${b.stake}` : `(${b.potential_payout} אפשרי)`;
    text += `${statusIcon} ${b.home_team} נגד ${b.away_team}\n   ${b.selected_outcome} | ${pts} נקודות\n\n`;
  });
  await msg.reply(text);
}

module.exports = { handleDmMessage };
