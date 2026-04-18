'use strict';

const pool = require('../utils/db');
const { buildLeaderboardMessage } = require('../utils/formatters');

async function notifyGameResult(client, gameId) {
  const gameRes = await pool.query(
    `SELECT home_team, away_team, score_home, score_away FROM games WHERE id = $1`, [gameId]
  );
  const game = gameRes.rows[0];
  if (!game) return;

  const leaguesRes = await pool.query(
    `SELECT DISTINCT wg.wa_group_id, wgm.league_id, wls.leaderboard_frequency, l.name AS league_name
     FROM wa_game_messages wgm
     JOIN wa_groups wg ON wg.league_id = wgm.league_id AND wg.is_active = true
     LEFT JOIN wa_league_settings wls ON wls.league_id = wgm.league_id
     JOIN leagues l ON l.id = wgm.league_id
     WHERE wgm.game_id = $1 AND wgm.group_jid IS NOT NULL`,
    [gameId]
  );

  for (const row of leaguesRes.rows) {
    try {
      const betsRes = await pool.query(
        `SELECT b.status, b.actual_payout, b.odds, u.username
         FROM bets b JOIN users u ON u.id = b.user_id
         WHERE b.game_id = $1 AND b.league_id = $2 AND b.wa_bet = true AND b.status != 'cancelled'`,
        [gameId, row.league_id]
      );

      const score = game.score_home != null ? `${game.score_home}-${game.score_away}` : '';
      const won = betsRes.rows.filter(b => b.status === 'won');
      const lost = betsRes.rows.filter(b => b.status === 'lost');
      const rankEmoji = ['🥇', '🥈', '🥉'];

      let msg = `━━━━━━━━━━━━━━━━━━━━━━\n📊 *${game.home_team} ${score} ${game.away_team}*\n`;
      if (won.length) {
        msg += `\n🏆 מנצחים:\n`;
        won.forEach((b, i) => { msg += `${rankEmoji[i] || '🎉'} ${b.username} — +${b.actual_payout} נק׳ (x${b.odds})\n`; });
      }
      if (lost.length) {
        msg += `\n😔 לא הצלחנו: ${lost.map(b => b.username).join(', ')}\n`;
      }

      if (row.leaderboard_frequency === 'after_game') {
        const members = await pool.query(
          `SELECT u.username, lm.points_in_league
           FROM league_members lm JOIN users u ON u.id = lm.user_id
           WHERE lm.league_id = $1 AND lm.is_active = true ORDER BY lm.points_in_league DESC`,
          [row.league_id]
        );
        msg += '\n' + buildLeaderboardMessage(members.rows, row.league_name);
      } else {
        msg += `━━━━━━━━━━━━━━━━━━━━━━`;
      }

      await client.sendMessage(row.wa_group_id, msg);
    } catch (err) {
      console.error('[WA] resultNotifier error:', err.message);
    }
  }
}

module.exports = { notifyGameResult };
