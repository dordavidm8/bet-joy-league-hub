'use strict';

const { pool } = require('../utils/db');
const { extractNumber } = require('../utils/phoneUtils');
const { processBetReply } = require('./groupHandler');
const { getState, setState, clearState } = require('./stateRouter');
const { formatPoints } = require('../utils/formatters');
const { getHealthStatus, DEVELOPER_NUMBER } = require('../health');

function getHelpText() {
  return `👋 *שלום! אני הבוט של Kickoff* ⚽\n\n` +
    `*פקודות בפרטי:* ✉️\n` +
    `• *יתרה* — הצג את יתרת הנקודות שלך\n` +
    `• *הימורים* — ההימורים האחרונים שלך\n` +
    `• *עזרה* / *?* — תפריט זה\n\n` +
    `*בקבוצת הליגה:* ⚽\n` +
    `• "שלח טבלה גבר" — צפייה בטבלה\n` +
    `• הימור: השב להודעת משחק עם *1*, *X*, *תיקו* או *2* (ניתן להוסיף גם תוצאה מדויקת)\n` +
    `• תיקון: השב להודעת האישור שלך עם המילה "תיקון" ומתחתיה ההימור המעודכן\n\n` +
    `כדי להמר בפרטי — השב להודעת המשחק שנשלחה אליך 🎯`;
}

async function handleDmMessage(client, msg) {
  const content = msg.body.trim().toLowerCase();
  const contact = await msg.getContact();
  const rawPhone = contact.number;
  const { normalizePhone } = require('../utils/phoneUtils');
  const phone = normalizePhone(rawPhone);

  // Developer Commands
  if (content === '/status' || content === 'status' || content === 'סטטוס') {
    if (phone === '972526980000') {
      const status = await getHealthStatus();
      await msg.reply(status);
      return;
    }
  }
  
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

    const prevBetRes = await pool.query(
      `SELECT b.* FROM bets b
       JOIN users u ON u.id = b.user_id
       WHERE u.phone_number = $2 
       AND (b.wa_bet_message_id = $1 OR b.wa_confirmation_message_id = $1)
       AND b.status = 'pending'
       ORDER BY b.placed_at DESC LIMIT 1`,
      [quotedId, phone]
    );
    if (prevBetRes.rows[0]) {
      const { processBetCorrection } = require('./groupHandler');
      await processBetCorrection(client, msg, phone, prevBetRes.rows[0]);
      return;
    }
  }

  // Route commands
  const cmd = content;
  if (cmd === '/help' || cmd === 'עזרה' || cmd === 'תפריט' || cmd === '?') {
    await msg.reply(getHelpText());
  } else if (cmd === '/balance' || cmd === 'יתרה') {
    await sendBalance(msg, user);
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
  await msg.reply(`💰 *${user.username}*, יתרתך: *${formatPoints(user.points_balance, false)} נקודות*`);
}


async function sendMyBets(msg, user) {
  const { translateTeam } = require('../utils/teamNames');
  const betsRes = await pool.query(
    `SELECT b.*, g.home_team, g.away_team, g.score_home, g.score_away, g.status AS game_status, bq.type AS bet_type, bq.question_text,
            l.name AS league_name
     FROM bets b
     JOIN games g ON g.id = b.game_id
     JOIN bet_questions bq ON bq.id = b.bet_question_id
     LEFT JOIN leagues l ON l.id = b.league_id
     WHERE b.user_id = $1
       AND (b.status = 'pending' OR (b.status != 'pending' AND g.start_time > NOW() - INTERVAL '36 hours'))
     ORDER BY (b.status = 'pending') ASC, g.start_time DESC, g.id, b.placed_at ASC`,
    [user.id]
  );

  if (betsRes.rows.length === 0) {
    await msg.reply('אין הימורים פעילים או מה-24 שעות האחרונות 🤷');
    return;
  }

  const typeLabels = {
    'match_winner': 'זהות המנצחת',
    'exact_score': 'תוצאה מדויקת',
    'over_under': 'מעל/מתחת 2.5',
    'both_teams_score': 'שתי הקבוצות יבקיעו',
    'btts': 'שתי הקבוצות יבקיעו'
  };

  const groups = {}; // Use gameId as key to keep order from SQL
  const groupOrder = []; 

  betsRes.rows.forEach(b => {
    if (!groups[b.game_id]) {
      const home = translateTeam(b.home_team);
      const away = translateTeam(b.away_team);
      
      let teamsDisplay;
      if (b.game_status === 'finished' && b.score_home !== null) {
        teamsDisplay = `⚽ *${home} (${b.score_home}) - (${b.score_away}) ${away}*`;
      } else {
        teamsDisplay = `⚽ *${home} - ${away}*`;
      }
      
      groups[b.game_id] = {
        teams: teamsDisplay,
        bets: []
      };
      groupOrder.push(b.game_id);
    }
    groups[b.game_id].bets.push(b);
  });

  let text = `🎯 *ההימורים שלי:*\n\n`;
  
  for (const gameId of groupOrder) {
    const g = groups[gameId];
    text += `${g.teams}\n`;
    
    g.bets.forEach(b => {
      const statusIcon = b.status === 'won' ? '✅' : b.status === 'lost' ? '❌' : '⏳';
      const label = typeLabels[b.bet_type] || 'הימור';
      
      // Translate outcome
      let outcome = b.selected_outcome;
      if (outcome === 'Draw') outcome = 'תיקו';
      else if (outcome === b.home_team) outcome = translateTeam(b.home_team);
      else if (outcome === b.away_team) outcome = translateTeam(b.away_team);
      else if (outcome === 'Yes') outcome = 'כן';
      else if (outcome === 'No') outcome = 'לא';
      else if (outcome === 'Over 2.5') outcome = 'מעל 2.5';
      else if (outcome === 'Under 2.5') outcome = 'מתחת 2.5';
      
      let betDetail = `${label}: *${outcome}*`;
      if (b.exact_score_prediction) {
        betDetail += ` (תוצאה: ${b.exact_score_prediction})`;
      }
      
      const leagueLabel = b.league_name ? `🏆 ליגת ${b.league_name}` : `✉️ הימור חופשי`;
      const payoutInfo = b.status === 'won' ? ` | זכייה: *${b.actual_payout}*` : 
                         b.status === 'pending' ? ` | זכייה אפשרית: *${b.potential_payout}*` : '';

      text += `${statusIcon} ${betDetail} | ${leagueLabel} | ${b.stake} נק'${payoutInfo}\n`;
    });
    text += `\n`;
  }

  await msg.reply(text.trim());
}

module.exports = { handleDmMessage };
