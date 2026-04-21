const { pool } = require('./src/utils/db');
(async () => {
  try {
    await pool.query('ALTER TABLE bets ADD COLUMN IF NOT EXISTS wa_confirmation_message_id TEXT');
    console.log('Column added successfully');
  } catch (err) {
    console.error('Migration failed:', err.message);
  }
  process.exit(0);
})();
