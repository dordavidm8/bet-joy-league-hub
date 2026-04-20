'use strict';

const cron = require('node-cron');
const { pool } = require('./utils/db');
const { formatHHMM } = require('./utils/formatters');
const { sendMorningMessages } = require('./notifications/morningMessages');
const { sendLeaderboard } = require('./notifications/leaderboardNotifier');
const { sendReminders } = require('./notifications/reminderNotifier');

function startScheduledJobs(client) {
  // ── Every minute: morning messages + leaderboard ────────────────────────────
  cron.schedule('* * * * *', async () => {
    const now = new Date();
    const hhmm = formatHHMM(new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' })));
    const dayOfWeek = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' })).getDay();

    try {
      // Morning messages
      const morningLeagues = await pool.query(
        `SELECT wls.*, wg.wa_group_id, l.name AS league_name, l.id AS league_id_val
         FROM wa_league_settings wls
         JOIN wa_groups wg ON wg.league_id = wls.league_id AND wg.is_active = true
         JOIN leagues l ON l.id = wls.league_id
         WHERE wls.morning_message_time::text LIKE $1`,
        [`${hhmm}%`]
      );
      for (const league of morningLeagues.rows) {
        await sendMorningMessages(client, league).catch(e =>
          console.error(`[jobs] morning error league ${league.league_id}:`, e.message)
        );
      }

      // Daily leaderboard
      const dailyLeagues = await pool.query(
        `SELECT wls.*, wg.wa_group_id, l.name AS league_name
         FROM wa_league_settings wls
         JOIN wa_groups wg ON wg.league_id = wls.league_id AND wg.is_active = true
         JOIN leagues l ON l.id = wls.league_id
         WHERE wls.leaderboard_frequency = 'daily' AND wls.leaderboard_time::text LIKE $1`,
        [`${hhmm}%`]
      );
      for (const league of dailyLeagues.rows) {
        await sendLeaderboard(client, league).catch(e =>
          console.error(`[jobs] leaderboard error:`, e.message)
        );
      }

      // Weekly leaderboard
      const weeklyLeagues = await pool.query(
        `SELECT wls.*, wg.wa_group_id, l.name AS league_name
         FROM wa_league_settings wls
         JOIN wa_groups wg ON wg.league_id = wls.league_id AND wg.is_active = true
         JOIN leagues l ON l.id = wls.league_id
         WHERE wls.leaderboard_frequency = 'weekly'
           AND wls.leaderboard_day = $1
           AND wls.leaderboard_time::text LIKE $2`,
        [dayOfWeek, `${hhmm}%`]
      );
      for (const league of weeklyLeagues.rows) {
        await sendLeaderboard(client, league).catch(e =>
          console.error(`[jobs] weekly leaderboard error:`, e.message)
        );
      }
    } catch (err) {
      console.error('[jobs] minute tick error:', err.message);
    }
  });

  // ── Every 5 minutes: reminders before bet close ──────────────────────────────
  cron.schedule('*/5 * * * *', async () => {
    try {
      await sendReminders(client);
    } catch (err) {
      console.error('[jobs] reminder error:', err.message);
    }
  });

  // ── Every 10 minutes: flush pending messages ──────────────────────────────────
  cron.schedule('*/10 * * * *', async () => {
    try {
      const rows = await pool.query(
        `SELECT id, phone, group_jid, text FROM wa_pending_messages WHERE sent = false ORDER BY created_at LIMIT 30`
      );
      for (const row of rows.rows) {
        try {
          const jid = row.group_jid || `${row.phone}@c.us`;
          await client.sendMessage(jid, row.text);
          await pool.query(`UPDATE wa_pending_messages SET sent = true WHERE id = $1`, [row.id]);
        } catch {}
      }
    } catch {}
  });

  // ── Daily at 03:00: clean expired sessions + OTP codes ───────────────────────
  cron.schedule('0 3 * * *', async () => {
    try {
      await pool.query(`DELETE FROM wa_verification_codes WHERE expires_at < NOW()`);
      await pool.query(`DELETE FROM wa_sessions WHERE last_msg_at < NOW() - INTERVAL '7 days'`);
      console.log('[jobs] cleanup done');
    } catch (err) {
      console.error('[jobs] cleanup error:', err.message);
    }
  });

  // ── Daily at 04:00: Leave groups of finished leagues or orphaned groups ──────
  cron.schedule('0 4 * * *', async () => {
    console.log('[jobs] Starting group cleanup check...');
    try {
      // 1. Groups connected to finished leagues
      const finishedRes = await pool.query(
        `SELECT wg.wa_group_id, l.name FROM wa_groups wg
         JOIN leagues l ON l.id = wg.league_id
         WHERE l.status IN ('finished', 'stopped') AND wg.is_active = true`
      );
      for (const row of finishedRes.rows) {
        try {
          const chat = await client.getChatById(row.wa_group_id);
          await chat.sendMessage(`⚠️ הליגה הסתיימה/הופסקה. הבוט יוצא מהקבוצה. להתראות! 👋`);
          await chat.leave();
          await pool.query(`UPDATE wa_groups SET is_active = false WHERE wa_group_id = $1`, [row.wa_group_id]);
          console.log(`[jobs] Left group for finished league: ${row.name}`);
        } catch (e) { console.warn(`[jobs] Failed to leave group ${row.wa_group_id}:`, e.message); }
      }

      // 2. Orphaned groups (bot is in group but it's not connected to any league in DB)
      const chats = await client.getChats();
      const groups = chats.filter(c => c.isGroup);
      
      const activeGroupsRes = await pool.query(`SELECT wa_group_id FROM wa_groups WHERE is_active = true`);
      const activeIds = new Set(activeGroupsRes.rows.map(r => r.wa_group_id));

      for (const group of groups) {
        if (!activeIds.has(group.id._serialized)) {
          // If bot is admin, it can leave safely. If not, also leave. 
          // User asked to leave groups not connected to leagues.
          console.log(`[jobs] Leaving orphaned group: ${group.name}`);
          try {
            await group.sendMessage(`⚠️ קבוצה זו אינה מחוברת לליגה פעילה ב-Kickoff. הבוט יוצא מהקבוצה. 👋`);
            await group.leave();
          } catch (e) { console.warn(`[jobs] Failed to leave orphaned group ${group.name}:`, e.message); }
        }
      }
    } catch (err) { console.error('[jobs] group cleanup error:', err.message); }
  });

  // ── Daily at 05:00: Alert developer if finished games have pending bets ──────
  cron.schedule('0 5 * * *', async () => {
    try {
      const pendingRes = await pool.query(
        `SELECT COUNT(*) FROM bets b
         JOIN games g ON g.id = b.game_id
         WHERE g.status = 'finished' AND b.status = 'pending'
           AND g.start_time < NOW() - INTERVAL '12 hours'`
      );
      const count = parseInt(pendingRes.rows[0].count);
      if (count > 0) {
        const { DEVELOPER_NUMBER } = require('./health');
        await client.sendMessage(DEVELOPER_NUMBER, `⚠️ *Alert: Unprocessed Bets*
There are ${count} pending bets for games that finished > 12 hours ago.
Please run settlement manually or check logs.`);
      }
    } catch (err) { console.error('[jobs] settlement check error:', err.message); }
  });

  console.log('[WA] Scheduled jobs פעילים ✅');
}

module.exports = { startScheduledJobs };
