const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function migrate() {
  try {
    console.log('Migrating columns to support decimals...');
    await pool.query(`ALTER TABLE users ALTER COLUMN points_balance TYPE NUMERIC(20,2)`);
    await pool.query(`ALTER TABLE bets ALTER COLUMN potential_payout TYPE NUMERIC(20,2)`);
    await pool.query(`ALTER TABLE bets ALTER COLUMN actual_payout TYPE NUMERIC(20,2)`);
    await pool.query(`ALTER TABLE league_members ALTER COLUMN points_in_league TYPE NUMERIC(20,2)`);
    console.log('Migration successful!');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    process.exit(0);
  }
}
migrate();
