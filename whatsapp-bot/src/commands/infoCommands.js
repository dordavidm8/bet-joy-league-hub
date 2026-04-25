/**
 * commands/infoCommands.js – פקודות מידע
 *
 * sendHelp(msg)       – שולח הוראות שימוש
 * sendRules(msg)      – שולח חוקי ההימורים
 * sendHowToJoin(msg)  – הסבר על הצטרפות לליגה
 */
'use strict';

const pool = require('../utils/db');

async function handleBalance(msg, user) {
  await msg.reply(`💰 יתרת הנקודות שלך: *${user.points_balance.toLocaleString()}* נק׳`);
}

async function handleGames(msg) {
  const res = await pool.query(
    `SELECT home_team, away_team, start_time FROM games
     WHERE status = 'scheduled' AND start_time > NOW() AND start_time < NOW() + INTERVAL '3 days'
     ORDER BY start_time ASC LIMIT 5`
  );
  if (!res.rows.length) { await msg.reply('אין משחקים קרובים כרגע.'); return; }

  let text = '⚽ *משחקים קרובים:*\n';
  res.rows.forEach((g, i) => {
    const t = new Date(g.start_time).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
    text += `${i + 1}. ${g.home_team} נגד ${g.away_team} | ${t}\n`;
  });
  await msg.reply(text);
}

async function handleMyBets(msg, user) {
  const res = await pool.query(
    `SELECT b.selected_outcome, b.stake, b.odds, b.status, b.placed_at,
            g.home_team, g.away_team
     FROM bets b JOIN games g ON g.id = b.game_id
     WHERE b.user_id = $1 ORDER BY b.placed_at DESC LIMIT 5`,
    [user.id]
  );
  if (!res.rows.length) { await msg.reply('אין לך הימורים עדיין.'); return; }

  const statusEmoji = { won: '✅', lost: '❌', pending: '⏳', cancelled: '🚫' };
  let text = '📋 *ההימורים האחרונים שלך:*\n';
  res.rows.forEach(b => {
    text += `${statusEmoji[b.status] || '?'} ${b.home_team} נגד ${b.away_team} — ${b.selected_outcome} (x${b.odds})\n`;
  });
  await msg.reply(text);
}

async function handleLeagues(msg, user) {
  const res = await pool.query(
    `SELECT l.name, lm.points_in_league
     FROM leagues l JOIN league_members lm ON lm.league_id = l.id
     WHERE lm.user_id = $1 AND l.status = 'active' AND lm.is_active = true`,
    [user.id]
  );
  if (!res.rows.length) { await msg.reply('אתה לא חבר בליגות פעילות.'); return; }

  let text = '🏆 *הליגות שלך:*\n';
  res.rows.forEach(l => {
    text += `• ${l.name} — ${l.points_in_league} נק׳\n`;
  });
  await msg.reply(text);
}

async function handleHelp(msg) {
  await msg.reply(
    `*DerbyUp Bot — עזרה* 🤖\n\n` +
    `*/balance* / *יתרה* — יתרת נקודות\n` +
    `*/games* / *משחקים* — משחקים קרובים\n` +
    `*/mybets* — הימורים אחרונים\n` +
    `*/leagues* — הליגות שלך\n\n` +
    `*בקבוצת הליגה:* ⚽\n` +
    `• "שלח טבלה גבר" — צפייה בטבלה\n` +
    `• הימור: השב להודעת משחק עם *1*, *X* או *2*\n` +
    `• תיקון: השב להודעת האישור שלך עם המילה "תיקון" ומתחתיה ההימור המעודכן`
  );
}

module.exports = { handleBalance, handleGames, handleMyBets, handleLeagues, handleHelp };
