'use strict';

function buildGameMessage(game, league) {
  const startTime = new Date(game.start_time);
  const timeStr = startTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  const dateStr = startTime.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' });

  let msg = `⚽ *${game.home_team}* נגד *${game.away_team}*\n`;
  msg += `🗓 ${dateStr} | ${timeStr}\n\n`;
  msg += `הגב להודעה זו עם ההימור שלך:\n`;
  msg += `• *1* — ניצחון ${game.home_team}\n`;
  msg += `• *X* — תיקו\n`;
  msg += `• *2* — ניצחון ${game.away_team}\n`;

  if (league?.exact_score_enabled) {
    msg += `\nלהימור על תוצאה מדויקת, הוסף שורה שנייה:\n  1\n  2-0\n(מכפיל x3 על יחס הניצחון)`;
  }
  return msg;
}

function buildLeaderboardMessage(members, leagueName) {
  const rankEmoji = ['🥇', '🥈', '🥉'];
  let msg = `📊 *טבלת ליגת "${leagueName}"*\n━━━━━━━━━━━━━━━━━━━━━━\n`;
  members.forEach((m, i) => {
    msg += `${rankEmoji[i] || `${i + 1}.`} ${m.username} — ${m.points_in_league.toLocaleString()} נקודות\n`;
  });
  msg += `━━━━━━━━━━━━━━━━━━━━━━`;
  return msg;
}

module.exports = { buildGameMessage, buildLeaderboardMessage };
