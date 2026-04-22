const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixIndices() {
  const client = await pool.connect();
  try {
    console.log('Dropping old global index...');
    await client.query('DROP INDEX IF EXISTS idx_bets_user_question_global');
    
    console.log('Creating new global index (ignoring cancelled bets)...');
    await client.query(`
      CREATE UNIQUE INDEX idx_bets_user_question_global 
      ON bets (user_id, bet_question_id) 
      WHERE (league_id IS NULL AND status != 'cancelled')
    `);

    console.log('Checking for league index...');
    await client.query('DROP INDEX IF EXISTS idx_bets_user_question_league');
    console.log('Creating new league index (ignoring cancelled bets)...');
    await client.query(`
      CREATE UNIQUE INDEX idx_bets_user_question_league 
      ON bets (user_id, bet_question_id, league_id) 
      WHERE (league_id IS NOT NULL AND status != 'cancelled')
    `);

    console.log('Indices updated successfully!');
  } catch (err) {
    console.error('Error updating indices:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

fixIndices();
