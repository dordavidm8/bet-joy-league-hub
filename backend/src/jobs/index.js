/**
 * jobs/index.js – מנהל Cron Jobs
 *
 * מאתחל ומריץ את כל ה-cron jobs באמצעות node-cron.
 * לוחות זמנים:
 *   כל דקה:       syncGames          – ESPN → DB
 *   כל 5 דקות:    settleBets         – סגירת הימורים
 *   כל 15 דקות:   featuredNotifications
 *   4:00 UTC:      daily fixture refresh + safety settlement
 *   00:00 UTC:     generateMiniGames  – 5 חידות יומיות
 *   06:00 UTC:     dailyReminder      – תזכורת טריוויה
 *   שבת 21:00 UTC: weeklyLeaderboard  – בונוס נקודות שבועי
 *   05:00 UTC:     socialMediaPost    – pipeline מדיה חברתית
 *   08:00 UTC:     socialAnalytics    – רענון מדדי engagement
 */
const cron = require('node-cron');
const { syncGames }  = require('./syncGames');
const { settleBets } = require('./settleBets');
const { generateAllMiniGames } = require('./generateMiniGames');
const { sendDailyChallengeReminder } = require('./dailyReminder');
const { sendWeeklyLeaderboardBonus } = require('./weeklyLeaderboard');
const { sendFeaturedMatchNotifications } = require('./featuredNotifications');

// In-memory locks to prevent overlapping executions
const runningJobs = new Set();
async function runLocked(name, fn) {
  if (runningJobs.has(name)) {
    console.log(`[cron:${name}] Already running, skipping overlap`);
    return;
  }
  runningJobs.add(name);
  const start = Date.now();
  try {
    await fn();
  } catch (err) {
    console.error(`[cron:${name}] Error:`, err.message);
  } finally {
    runningJobs.delete(name);
    const duration = ((Date.now() - start) / 1000).toFixed(1);
    if (duration > 5) console.log(`[cron:${name}] Finished in ${duration}s`);
  }
}

function startJobs() {
  // Sync live scores every 60 seconds
  cron.schedule('* * * * *', () => {
    runLocked('syncGames', syncGames);
  });

  // Settle bets every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    runLocked('settleBets', settleBets);
  });

  // Full fixture refresh + safety settlement every day at 04:00 UTC
  cron.schedule('0 4 * * *', async () => {
    console.log('[cron] Daily fixture refresh');
    try { await syncGames(); }
    catch (err) { console.error('[cron:dailySync]', err.message); }
    // Safety net: re-run settlement to catch any games missed during the day
    try { await settleBets(); }
    catch (err) { console.error('[cron:dailySettle]', err.message); }
  });

  // Generate daily mini games at 00:00 (midnight)
  cron.schedule('0 0 * * *', async () => {
    console.log('[cron] Daily minigames generation (midnight reset)');
    try { await generateAllMiniGames(); }
    catch (err) { console.error('[cron:generateMiniGames]', err.message); }
  });

  // Daily quiz reminder at 09:00 IST (06:00 UTC)
  cron.schedule('0 6 * * *', async () => {
    console.log('[cron] Daily challenge reminder');
    try { await sendDailyChallengeReminder(); }
    catch (err) { console.error('[cron:dailyReminder]', err.message); }
  });

  // Weekly leaderboard bonus — Sunday 00:00 IST = Saturday 21:00 UTC
  cron.schedule('0 21 * * 6', async () => {
    console.log('[cron] Weekly leaderboard bonus');
    try { await sendWeeklyLeaderboardBonus(); }
    catch (err) { console.error('[cron:weeklyLeaderboard]', err.message); }
  });

  // Featured match notifications — every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    try { await sendFeaturedMatchNotifications(); }
    catch (err) { console.error('[cron:featuredNotif]', err.message); }
  });

  // ── Social Media Agents ─────────────────────────────────────────────────
  const { runDailySocialMediaPipeline } = require('./socialMediaPost');

  // Removed V1 socialGrowth cron

  // 05:00 UTC = 08:00 IST (Daily social pipeline)
  cron.schedule('0 5 * * *', async () => {
    try { await runDailySocialMediaPipeline({ triggeredBy: 'cron' }); }
    catch (err) { console.error('[cron:socialPipeline]', err.message); }
  });

  // 08:00 UTC = 11:00 IST (Analytics refresh)
  cron.schedule('0 8 * * *', async () => {
    try {
      const { runDailyAnalyticsRefresh } = require('./socialAnalytics');
      await runDailyAnalyticsRefresh();
    } catch (err) { console.error('[cron:socialAnalytics]', err.message); }
  });

  // Every 4 hours (Social Listening)
  cron.schedule('0 */4 * * *', async () => {
    try {
      const { runSocialListening } = require('./socialListening');
      await runSocialListening();
    } catch (err) { console.error('[cron:socialListening]', err.message); }
  });

  console.log('[jobs] Cron jobs started: syncGames, settleBets, dailySync, miniGames, dailyReminder, weeklyBonus, featuredNotif, socialPipeline, socialListening, socialAnalytics');
}

module.exports = { startJobs, startCronJobs: startJobs };
