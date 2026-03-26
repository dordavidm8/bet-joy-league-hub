require('dotenv').config();
const { generateAllMiniGames } = require('./src/jobs/generateMiniGames');
// Note: verify generateMiniGames doesn't close pool or if it does, we handle it
generateAllMiniGames().then(() => {
    console.log('--- MINI GAMES GENERATED ---');
    process.exit(0);
}).catch(e => {
    console.error('--- MINI GAMES FAILED ---', e);
    process.exit(1);
});
