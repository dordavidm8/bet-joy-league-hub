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
    `• תיקון: השב להודעת האישור עם ההימור המעודכן\n\n` +
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
            l.name AS league_name, l.bet_mode AS league_bet_mode, l.access_type AS league_access_type,
            p.parlay_number, p.status AS parlay_status,
            t1.name_he as home_he_db, t2.name_he as away_he_db
     FROM bets b
     JOIN games g ON g.id = b.game_id
     JOIN bet_questions bq ON bq.id = b.bet_question_id
     LEFT JOIN leagues l ON l.id = b.league_id
     LEFT JOIN parlays p ON p.id = b.parlay_id
     LEFT JOIN team_name_translations t1 ON t1.name_en = g.home_team
     LEFT JOIN team_name_translations t2 ON t2.name_en = g.away_team
     WHERE b.user_id = $1
       AND b.status != 'cancelled'
       AND (b.status = 'pending' OR (b.status != 'pending' AND g.start_time > NOW() - INTERVAL '24 hours'))
     ORDER BY g.start_time ASC, g.id, b.placed_at ASC`,
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

  const finishedGroups = {};
  const pendingGroups = {};
  const finishedOrder = [];
  const pendingOrder = [];

  betsRes.rows.forEach(b => {
    const isFinished = b.status !== 'pending';
    const targetGroups = isFinished ? finishedGroups : pendingGroups;
    const targetOrder = isFinished ? finishedOrder : pendingOrder;

    if (!targetGroups[b.game_id]) {
      const home = b.home_he_db || translateTeam(b.home_team);
      const away = b.away_he_db || translateTeam(b.away_team);
      
      let teamsDisplay;
      if (b.game_status === 'finished' && b.score_home !== null) {
        teamsDisplay = `⚽ *${home} (${b.score_home}) - (${b.score_away}) ${away}*`;
      } else {
        teamsDisplay = `⚽ *${home} - ${away}*`;
      }
      
      targetGroups[b.game_id] = {
        teams: teamsDisplay,
        bets: []
      };
      targetOrder.push(b.game_id);
    }
    targetGroups[b.game_id].bets.push(b);
  });

  const formatBetLine = (b) => {
    let statusIcon;
    if (b.status === 'won') statusIcon = '✅';
    else if (b.status === 'lost' || b.status === 'parlay_failed') statusIcon = '❌';
    else statusIcon = '⏳';

    const label = typeLabels[b.bet_type] || 'הימור';
    
    let outcome = b.selected_outcome;
    if (outcome === 'Draw') outcome = 'תיקו';
    else if (outcome === b.home_team) outcome = b.home_he_db || translateTeam(b.home_team);
    else if (outcome === b.away_team) outcome = b.away_he_db || translateTeam(b.away_team);
    else if (outcome === 'Yes') outcome = 'כן';
    else if (outcome === 'No') outcome = 'לא';
    else if (outcome === 'Over 2.5') outcome = 'מעל 2.5';
    else if (outcome === 'Under 2.5') outcome = 'מתחת 2.5';
    
    let betDetail = `${label}: *${outcome}*`;
    if (b.exact_score_prediction) {
      betDetail += ` (תוצאה: ${b.exact_score_prediction})`;
    }

    let contextLabel;
    if (b.parlay_number) {
      const parlayStatusLabel = b.parlay_status === 'lost' ? ' ❌ נכשל' : b.parlay_status === 'won' ? ' ✅ ניצח' : '';
      contextLabel = `🔗 פרליי #${b.parlay_number}${parlayStatusLabel}`;
    } else if (b.league_id) {
      const type = b.league_access_type === 'public' ? 'ליגה ציבורית' : 'ליגה פרטית';
      contextLabel = `🏆 ${type}: ${b.league_name}`;
    } else {
      contextLabel = `✉️ הימור חופשי`;
    }

    const isShared = b.league_bet_mode === 'initial_balance';
    const stakeDisplay = isShared ? '💎 קופה משותפת' : `${b.stake} נק'`;
    
    let payoutValue = b.potential_payout;
    if (isShared && b.status === 'pending') {
      payoutValue = (parseFloat(String(b.odds)) * (b.exact_score_prediction ? 3 : 1)).toFixed(2);
    }

    const payoutInfo = (b.status === 'won' && b.actual_payout) ? ` | זכייה: *${b.actual_payout}*` :
                       (b.status === 'pending') ? ` | אפשרי: *${payoutValue}*` :
                       (b.status === 'parlay_failed') ? ` | נכשל במסגרת פרליי` : '';

    return `${statusIcon} ${betDetail} | ${contextLabel} | ${stakeDisplay}${payoutInfo}\n`;
  };

  let text = `🎯 *ההימורים שלי:*\n\n`;

  if (finishedOrder.length > 0) {
    text += `*הסתיימו (24 שעות אחרונות)*\n`;
    text += `–––––––––––––––––––––––––––\n\n`;
    for (const gameId of finishedOrder) {
      const g = finishedGroups[gameId];
      text += `${g.teams}\n`;
      g.bets.forEach(b => {
        text += formatBetLine(b);
      });
      text += `\n`;
    }
  }

  if (pendingOrder.length > 0) {
    text += `*הימורים פתוחים*\n`;
    text += `–––––––––––––––––––––––––––\n\n`;
    for (const gameId of pendingOrder) {
      const g = pendingGroups[gameId];
      text += `${g.teams}\n`;
      g.bets.forEach(b => {
        text += formatBetLine(b);
      });
      text += `\n`;
    }
  }

  await msg.reply(text.trim());
}

module.exports = { handleDmMessage };
