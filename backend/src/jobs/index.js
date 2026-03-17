const cron = require('node-cron');
const { syncLiveGames, syncUpcomingFixtures } = require('./syncGames');
const { settleBets } = require('./settleBets');

function startCronJobs(io) {
  // Sync live scores every 60 seconds
  cron.schedule('* * * * *', () => syncLiveGames(io));

  // Settle finished bets every 5 minutes
  cron.schedule('*/5 * * * *', () => settleBets());

  // Sync upcoming fixtures once a day at 6am
  cron.schedule('0 6 * * *', () => syncUpcomingFixtures());

  console.log('⏱️  Cron jobs started');
}

module.exports = { startCronJobs };
