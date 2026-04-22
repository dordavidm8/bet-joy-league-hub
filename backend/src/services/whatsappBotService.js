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
      signal: AbortSignal.timeout(30000), // Increased to 30s for group creation
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

  // Get ALL league members
  const membersRes = await pool.query(
    `SELECT u.id as user_id, u.username
     FROM league_members lm
     JOIN users u ON u.id = lm.user_id
     WHERE lm.league_id = $1 AND lm.is_active = true`,
    [leagueId]
  );

  // Get ALL bets for this game and league
  const betsRes = await pool.query(
    `SELECT user_id, status, actual_payout, odds
     FROM bets
     WHERE game_id = $1 AND league_id = $2 AND status != 'cancelled'`,
    [gameId, leagueId]
  );

  const betsMap = {};
  betsRes.rows.forEach(b => { betsMap[b.user_id] = b; });

  const winners = [];
  const noPoints = [];

  membersRes.rows.forEach(m => {
    const bet = betsMap[m.user_id];
    if (bet && bet.status === 'won') {
      // Check if exact score bonus was hit (payout is roughly 3x odds, or exactly 3x odds in shared pot)
      const baseOdds = parseFloat(bet.odds);
      const payout = parseFloat(bet.actual_payout);
      const isExactHit = payout > (baseOdds * 1.5); // covers both stake-based and shared-pot

      winners.push({ 
        username: m.username, 
        payout: payout.toFixed(payout % 1 === 0 ? 0 : 2), 
        odds: baseOdds.toFixed(2),
        isExactHit
      });
    } else {
      noPoints.push(m.username);
    }
  });

  const score = game.score_home != null ? `${game.score_home}-${game.score_away}` : '';
  let msg = `📊 ${translateTeam(game.home_team)} ${score} ${translateTeam(game.away_team)}\n`;

  if (winners.length > 0) {
    msg += `\n🏆 מנצחים:\n`;
    winners.forEach(w => {
      msg += `🥇 ${w.username} — +${w.payout} נקודות (x${w.odds})${w.isExactHit ? ' 🎯' : ''}\n`;
    });
  }

  if (noPoints.length > 0) {
    msg += `\n😔 0 נקודות: ${noPoints.join(', ')}\n`;
  }

  return msg;
}

async function leaveGroup(groupJid) {
  const ok = await callBot('/internal/leave-group', { groupJid });
  return ok;
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
       ORDER BY lm.points_in_league DESC LIMIT 5`,
      [leagueId]
    );

    const dist = league.distribution || [];
    const rankEmoji = ['🥇', '🥈', '🥉'];
    let msg = `🏆🏆🏆 ליגת "${league.name}" הסתיימה! 🏆🏆🏆\n\n📊 תוצאות סופיות:\n\n`;

    membersRes.rows.forEach((m, i) => {
      const payoutAmount = i < dist.length ? Math.floor((dist[i].pct / 100) * league.pool_total) : 0;
      const payStr = payoutAmount > 0 ? ` [+${payoutAmount.toLocaleString()} נקודות!]` : '';
      msg += `${rankEmoji[i] || `${i + 1}.`} ${m.username} (${m.points_in_league})${payStr}\n\n`;
    });

    msg += `כל הכבוד לכולם! 🎉`;
    await sendGroup(groupRes.rows[0].wa_group_id, msg);

    // Wait a few seconds to let the message deliver, then leave the group
    setTimeout(async () => {
      try {
        console.log(`[WA] Leaving group ${groupRes.rows[0].wa_group_id} after league end`);
        await leaveGroup(groupRes.rows[0].wa_group_id);
      } catch (err) {
        console.error('[WA] Failed to leave group after league end:', err.message);
      }
    }, 5000);

  } catch (err) {
    console.error('[WA] notifyLeagueEnd error:', err.message);
  }
}

module.exports = { sendDM, sendGroup, leaveGroup, notifyGameResult, notifyLeagueEnd, callBot };
