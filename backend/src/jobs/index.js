const cron = require('node-cron');
const { syncGames }  = require('./syncGames');
const { settleBets } = require('./settleBets');
const { generateAllMiniGames } = require('./generateMiniGames');
const { sendDailyChallengeReminder } = require('./dailyReminder');
const { sendWeeklyLeaderboardBonus } = require('./weeklyLeaderboard');
const { sendFeaturedMatchNotifications } = require('./featuredNotifications');

function startJobs() {
  // Sync live scores every 60 seconds
  cron.schedule('* * * * *', async () => {
    try { await syncGames(); }
    catch (err) { console.error('[cron:syncGames]', err.message); }
  });

  // Settle bets every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try { await settleBets(); }
    catch (err) { console.error('[cron:settleBets]', err.message); }
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

  console.log('[jobs] Cron jobs started: syncGames, settleBets, dailySync, miniGames, dailyReminder, weeklyBonus, featuredNotif (15min)');
}

module.exports = { startJobs, startCronJobs: startJobs };
