'use strict';

const cron = require('node-cron');
const pool = require('./utils/db');
const { formatHHMM } = require('./utils/phoneUtils');
const { sendMorningMessages } = require('./notifications/morningMessages');
const { sendReminders } = require('./notifications/reminderNotifier');
const { sendScheduledLeaderboards } = require('./notifications/leaderboardNotifier');

function startScheduledJobs(client) {
  // Every minute: morning messages + leaderboards
  cron.schedule('* * * * *', async () => {
    const now = new Date();
    const timeStr = formatHHMM(now);
    const dayOfWeek = now.getDay();

    try {
      const leagues = await pool.query(
        `SELECT wls.*, wg.wa_group_id, l.tournament_slug, l.id AS league_id
         FROM wa_league_settings wls
         JOIN wa_groups wg ON wg.league_id = wls.league_id AND wg.is_active = true
         JOIN leagues l ON l.id = wls.league_id
         WHERE wls.morning_message_time::TEXT = $1`,
        [timeStr]
      );
      for (const league of leagues.rows) {
        sendMorningMessages(client, league).catch(err =>
          console.error('[WA] morning msg error:', err.message)
        );
      }
    } catch (err) {
      console.error('[WA] cron morning error:', err.message);
    }

    try {
      await sendScheduledLeaderboards(client, timeStr, dayOfWeek);
    } catch (err) {
      console.error('[WA] cron leaderboard error:', err.message);
    }
  });

  // Every 5 minutes: reminder check
  cron.schedule('*/5 * * * *', async () => {
    try {
      await sendReminders(client);
    } catch (err) {
      console.error('[WA] cron reminder error:', err.message);
    }
  });

  // Every 30 minutes: session cleanup (idle >30min already handled inline; this cleans DB)
  cron.schedule('*/30 * * * *', async () => {
    try {
      await pool.query(
        `UPDATE wa_sessions SET state = 'idle', context = '{}' WHERE last_msg_at < NOW() - INTERVAL '30 minutes'`
      );
    } catch (err) {
      console.error('[WA] session cleanup error:', err.message);
    }
  });

  // Hourly: flush pending messages
  cron.schedule('0 * * * *', async () => {
    try {
      const pending = await pool.query(
        `SELECT * FROM wa_pending_messages WHERE sent = false ORDER BY created_at LIMIT 20`
      );
      for (const row of pending.rows) {
        try {
          const jid = row.group_jid || `${row.phone}@c.us`;
          await client.sendMessage(jid, row.text);
          await pool.query(`UPDATE wa_pending_messages SET sent = true WHERE id = $1`, [row.id]);
        } catch (_) {}
      }
    } catch (err) {
      console.error('[WA] pending flush error:', err.message);
    }
  });

  console.log('[WA] Scheduled jobs started');
}

module.exports = { startScheduledJobs };
