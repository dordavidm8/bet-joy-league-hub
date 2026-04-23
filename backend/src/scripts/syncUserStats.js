const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../whatsapp-bot/.env') });
const { pool } = require('../config/database');

async function syncAllUserStats() {
  console.log('--- Starting Sync of User Stats ---');
  const client = await pool.connect();
  try {
    const usersRes = await client.query('SELECT id, username FROM users');
    console.log(`Found ${usersRes.rows.length} users to sync.`);

    for (const user of usersRes.rows) {
      const statsRes = await client.query(
        `SELECT 
           COUNT(*) FILTER (WHERE status != 'void' AND status != 'cancelled') as real_total_bets,
           COUNT(*) FILTER (WHERE status = 'won') as real_total_wins
         FROM bets WHERE user_id = $1`,
        [user.id]
      );
      
      const { real_total_bets, real_total_wins } = statsRes.rows[0];

      await client.query(
        'UPDATE users SET total_bets = $1, total_wins = $2 WHERE id = $3',
        [parseInt(real_total_bets), parseInt(real_total_wins), user.id]
      );
      
      console.log(`Synced @${user.username}: Bets=${real_total_bets}, Wins=${real_total_wins}`);
    }
    console.log('--- Sync Completed Successfully ---');
  } catch (err) {
    console.error('Error syncing stats:', err.message);
  } finally {
    client.release();
    process.exit(0);
  }
}

syncAllUserStats();
