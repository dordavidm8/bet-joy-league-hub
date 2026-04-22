const { pool } = require('../src/config/database');

async function migrate() {
  try {
    console.log('Migrating bets table columns to DECIMAL...');
    await pool.query(`
      ALTER TABLE bets 
      ALTER COLUMN actual_payout TYPE DECIMAL(10,2) USING actual_payout::DECIMAL(10,2),
      ALTER COLUMN potential_payout TYPE DECIMAL(10,2) USING potential_payout::DECIMAL(10,2);
    `);
    console.log('Success!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
