'use strict';

function formatHHMM(date) {
  return date.toTimeString().slice(0, 5); // 'HH:MM'
}

function formatDate(date) {
  return date.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatPoints(n) {
  return Number(n).toLocaleString('he-IL');
}

// Build the morning game message text
function buildGameMessage(game, leagueSettings) {
  const homeName = game.home_team_he || game.home_team;
  const awayName = game.away_team_he || game.away_team;
  const kickoff = new Date(game.start_time);
  const timeStr = kickoff.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' });
  const dateStr = kickoff.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric', timeZone: 'Asia/Jerusalem' });

  let msg = `⚽ *${homeName} נגד ${awayName}*\n`;
  msg += `🗓 ${dateStr} | ${timeStr}\n\n`;
  msg += `הגב להודעה זו עם ההימור שלך:\n`;
  msg += `• *1* — ניצחון ${homeName}\n`;
  msg += `• *X* — תיקו\n`;
  msg += `• *2* — ניצחון ${awayName}\n`;

  if (leagueSettings?.exact_score_enabled) {
    msg += `\nלהימור על *תוצאה מדויקת* (x3), הוסף שורה שנייה:\n`;
    msg += `  1\n  2-0`;
  }

  return msg;
}

const RANK_EMOJI = ['🥇', '🥈', '🥉'];

function buildLeaderboardMessage(leagueName, members) {
  let msg = `📊 *טבלת ליגת "${leagueName}"*\n\n`;
  members.forEach((m, i) => {
    const emoji = RANK_EMOJI[i] || `${i + 1}.`;
    msg += `${emoji} ${m.username} — ${formatPoints(m.points_in_league)} נקודות\n`;
  });
  return msg;
}

module.exports = { formatHHMM, formatDate, formatPoints, buildGameMessage, buildLeaderboardMessage, RANK_EMOJI };
