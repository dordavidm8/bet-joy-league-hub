const { pool } = require('./backend/src/config/database');

async function migrate() {
  try {
    console.log('Starting migration...');
    await pool.query(`
      ALTER TABLE bets ALTER COLUMN actual_payout TYPE DECIMAL(10,2);
      ALTER TABLE bets ALTER COLUMN potential_payout TYPE DECIMAL(10,2);
      ALTER TABLE parlays ALTER COLUMN actual_payout TYPE DECIMAL(10,2);
      ALTER TABLE parlays ALTER COLUMN potential_payout TYPE DECIMAL(10,2);
    `);
    console.log('Migration successful: actual_payout and potential_payout changed to DECIMAL(10,2)');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    process.exit();
  }
}

migrate();
