require('dotenv').config();
const { syncGames } = require('./src/jobs/syncGames');
const { settleBets } = require('./src/jobs/settleBets');
const { pool } = require('./src/config/database');

async function run() {
  console.log('--- STARTING MANUAL SYNC & SETTLE ---');
  try {
    await syncGames();
    console.log('[sync] Games synced.');
    await settleBets();
    console.log('[settle] Bets settled.');
    console.log('--- FINISHED ---');
  } catch (err) {
    console.error('--- FAILED ---', err.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

run();
