const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixIndices() {
  const client = await pool.connect();
  try {
    console.log('--- STARTING INDEX MIGRATION ---');
    
    console.log('Updating idx_bets_user_question_global...');
    await client.query('DROP INDEX IF EXISTS idx_bets_user_question_global');
    await client.query(`
      CREATE UNIQUE INDEX idx_bets_user_question_global 
      ON bets (user_id, bet_question_id) 
      WHERE (league_id IS NULL AND status != 'cancelled')
    `);

    console.log('Updating idx_bets_user_question_league...');
    await client.query('DROP INDEX IF EXISTS idx_bets_user_question_league');
    await client.query(`
      CREATE UNIQUE INDEX idx_bets_user_question_league 
      ON bets (user_id, bet_question_id, league_id) 
      WHERE (league_id IS NOT NULL AND status != 'cancelled')
    `);

    console.log('--- INDEX MIGRATION COMPLETED ---');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

fixIndices();
