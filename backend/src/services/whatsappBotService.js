'use strict';

const { pool } = require('../config/database');
const { translateTeam } = require('../lib/teamNames');

const BOT_INTERNAL_URL = process.env.BOT_INTERNAL_URL || 'http://localhost:4001';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || process.env.OPS_SECRET || '';

async function callBot(path, body) {
  if (!INTERNAL_API_KEY) {
    console.error('[WA] callBot: Missing INTERNAL_API_KEY');
    return null;
  }
  try {
    const url = `${BOT_INTERNAL_URL}${path}`;
    console.log('[WA] callBot calling:', url);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-key': INTERNAL_API_KEY },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000), // Increased to 8s
    });
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[WA] callBot failed: ${url} status=${res.status} body=${errorText}`);
      return null;
    }
    return res.json();
  } catch (err) {
    console.error(`[WA] callBot error (${path}):`, err.message);
    return null;
  }
}

async function queueMessage(phone, groupJid, text) {
  await pool.query(
    `INSERT INTO wa_pending_messages (phone, group_jid, text) VALUES ($1,$2,$3)`,
    [phone || null, groupJid || null, text]
  );
}

async function sendDM(phone, text) {
  const ok = await callBot('/internal/send', { phone, text });
  if (!ok) await queueMessage(phone, null, text);
}

async function sendGroup(groupJid, text) {
  const ok = await callBot('/internal/send-group', { groupJid, text });
  if (!ok) await queueMessage(null, groupJid, text);
}

async function notifyGameResult(gameId) {
  try {
    const res = await pool.query(
      `SELECT DISTINCT wg.wa_group_id, wgm.league_id
       FROM wa_game_messages wgm
       JOIN wa_groups wg ON wg.league_id = wgm.league_id AND wg.is_active = true
       WHERE wgm.game_id = $1 AND wgm.group_jid IS NOT NULL`,
      [gameId]
    );

    for (const row of res.rows) {
      const text = await buildResultMessage(gameId, row.league_id);
      if (text) await sendGroup(row.wa_group_id, text);
    }
  } catch (err) {
    console.error('[WA] notifyGameResult error:', err.message);
  }
}

async function buildResultMessage(gameId, leagueId) {
  const gameRes = await pool.query(
    `SELECT home_team, away_team, score_home, score_away FROM games WHERE id = $1`, [gameId]
  );
  const game = gameRes.rows[0];
  if (!game) return null;

  const betsRes = await pool.query(
    `SELECT b.user_id, b.selected_outcome, b.status, b.actual_payout, b.odds,
            u.username
     FROM bets b JOIN users u ON u.id = b.user_id
     WHERE b.game_id = $1 AND b.league_id = $2 AND b.wa_bet = true AND b.status != 'cancelled'`,
    [gameId, leagueId]
  );

  const won = betsRes.rows.filter(b => b.status === 'won');
  const lost = betsRes.rows.filter(b => b.status === 'lost');

  const membersRes = await pool.query(
    `SELECT u.username, lm.points_in_league
     FROM league_members lm JOIN users u ON u.id = lm.user_id
     WHERE lm.league_id = $1 AND lm.is_active = true
     ORDER BY lm.points_in_league DESC LIMIT 5`,
    [leagueId]
  );

  const rankEmoji = ['🥇', '🥈', '🥉'];
  const score = game.score_home != null ? `${game.score_home}-${game.score_away}` : '';
  let msg = `━━━━━━━━━━━━━━━━━━━━━━\n📊 ${translateTeam(game.home_team)} ${score} ${translateTeam(game.away_team)}\n`;

  if (won.length > 0) {
    msg += `\n🏆 מנצחים:\n`;
    won.forEach((b, i) => {
      msg += `${rankEmoji[i] || '🎉'} ${b.username} — +${b.actual_payout} נקודות (x${b.odds})\n`;
    });
  }
  if (lost.length > 0) {
    msg += `\n😔 לא הצלחנו: ${lost.map(b => b.username).join(', ')}\n`;
  }

  msg += `\n📊 דירוג ליגה:\n`;
  membersRes.rows.forEach((m, i) => {
    msg += `${i + 1}. ${m.username} — ${m.points_in_league} ⭐\n`;
  });
  msg += `━━━━━━━━━━━━━━━━━━━━━━`;
  return msg;
}

async function notifyLeagueEnd(leagueId) {
  try {
    const groupRes = await pool.query(
      `SELECT wa_group_id FROM wa_groups WHERE league_id = $1 AND is_active = true LIMIT 1`,
      [leagueId]
    );
    if (!groupRes.rows[0]) return;

    const leagueRes = await pool.query(`SELECT name, pool_total, distribution FROM leagues WHERE id = $1`, [leagueId]);
    const league = leagueRes.rows[0];
    if (!league) return;

    const membersRes = await pool.query(
      `SELECT u.username, lm.points_in_league
       FROM league_members lm JOIN users u ON u.id = lm.user_id
       WHERE lm.league_id = $1 AND lm.is_active = true
       ORDER BY lm.points_in_league DESC`,
      [leagueId]
    );

    const dist = league.distribution || [];
    const rankEmoji = ['🥇', '🥈', '🥉'];
    let msg = `🏆🏆🏆 ליגת "${league.name}" הסתיימה! 🏆🏆🏆\n\n📊 תוצאות סופיות:\n`;

    membersRes.rows.forEach((m, i) => {
      const payout = i < dist.length ? Math.floor(dist[i].pct / 100 * league.pool_total) : 0;
      const payStr = payout > 0 ? ` [+${payout.toLocaleString()} מהפרס!]` : '';
      msg += `${rankEmoji[i] || `${i + 1}.`} ${m.username} — ${m.points_in_league} נקודות${payStr}\n`;
    });

    msg += `\nכל הכבוד לכולם! 🎉`;
    await sendGroup(groupRes.rows[0].wa_group_id, msg);
  } catch (err) {
    console.error('[WA] notifyLeagueEnd error:', err.message);
  }
}

module.exports = { sendDM, sendGroup, notifyGameResult, notifyLeagueEnd, callBot };
