const cron = require('node-cron');
const { syncGames }  = require('./syncGames');
const { settleBets } = require('./settleBets');

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

  // Full fixture refresh every day at 04:00
  cron.schedule('0 4 * * *', async () => {
    console.log('[cron] Daily fixture refresh');
    try { await syncGames(); }
    catch (err) { console.error('[cron:dailySync]', err.message); }
  });

  console.log('[jobs] Cron jobs started: syncGames (1min), settleBets (5min), dailySync (04:00)');
}

module.exports = { startJobs, startCronJobs: startJobs };
