'use strict';

function formatHHMM(date) {
  return date.toTimeString().slice(0, 5); // 'HH:MM'
}

function formatDate(date) {
  return date.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatPoints(p) {
  const num = Number(p);
  return num % 1 === 0 ? num.toLocaleString('he-IL') : num.toFixed(1);
}

// Build the morning game message text
function buildGameMessage(game, leagueSettings) {
  const homeName = game.home_team_he || game.home_team;
  const awayName = game.away_team_he || game.away_team;
  const outcomes = game.outcomes || [];
  
  const getOdds = (outcome) => {
    const found = outcomes.find(o => o.label === outcome);
    return found ? found.odds.toFixed(2) : '2.00';
  };

  const kickoff = new Date(game.start_time);
  const timeStr = kickoff.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' });
  const dateStr = kickoff.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric', timeZone: 'Asia/Jerusalem' });

  let msg = `⚽ *${homeName} נגד ${awayName}*\n`;
  msg += `🗓 ${dateStr} | ${timeStr}\n\n`;
  msg += `הגב להודעה זו עם ההימור שלך:\n`;
  msg += `• *1* — ${homeName} (יחס: ${getOdds(game.home_team)})\n`;
  msg += `• *X* — תיקו (יחס: ${getOdds('Draw')})\n`;
  msg += `• *2* — ${awayName} (יחס: ${getOdds(game.away_team)})\n\n`;
  msg += `🎯 *ניתן להמר גם על תוצאה מדויקת!* (בונוס x3)\n`;
  msg += `פשוט הוסף את התוצאה לאחר ה-1,X,2.\n`;
  msg += `דוגמה: *1 2-1* (ניצחון לבית בתוצאה 2-1)`;

  return msg;
}

const RANK_EMOJI = ['🥇', '🥈', '🥉'];

function buildLeaderboardMessage(leagueName, members) {
  let msg = `📊 *טבלת ליגת "${leagueName}"*\n\n`;
  members.forEach((m, i) => {
    const emoji = RANK_EMOJI[i] || `${i + 1}.`;
    msg += `${emoji} ${m.username.toLowerCase()} — ${formatPoints(m.points_in_league)} נקודות\n`;
  });
  return msg;
}

module.exports = { formatHHMM, formatDate, formatPoints, buildGameMessage, buildLeaderboardMessage, RANK_EMOJI };
