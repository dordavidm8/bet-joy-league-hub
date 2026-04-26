/**
 * cleanup_deleted_users.js
 * 
 * This script finds all anonymized users (usernames starting with 'deleted_')
 * and performs a hard-delete on them, transferring league ownership if necessary.
 */
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function cleanup() {
  const client = await pool.connect();
  try {
    const users = await client.query(`SELECT id, username FROM users WHERE username LIKE 'deleted_%'`);
    console.log(`Found ${users.rows.length} anonymized users to cleanup.`);

    for (const user of users.rows) {
      console.log(`Cleaning up user: ${user.username} (${user.id})...`);
      await client.query('BEGIN');
      
      // 1. Handle dependencies that aren't ON DELETE CASCADE
      await client.query(`UPDATE users SET referred_by = NULL WHERE referred_by = $1`, [user.id]);
      await client.query(`DELETE FROM referrals WHERE referrer_id = $1 OR referred_id = $1`, [user.id]);
      
      // 2. Handle leagues where this user is the creator
      const creatorLeagues = await client.query(`SELECT id FROM leagues WHERE creator_id = $1`, [user.id]);
      for (const leg of creatorLeagues.rows) {
        const nextMember = await client.query(
          `SELECT user_id FROM league_members WHERE league_id = $1 AND user_id != $2 ORDER BY joined_at ASC LIMIT 1`,
          [leg.id, user.id]
        );
        if (nextMember.rows[0]) {
          console.log(`  Transferring league ${leg.id} to user ${nextMember.rows[0].user_id}`);
          await client.query(`UPDATE leagues SET creator_id = $1 WHERE id = $2`, [nextMember.rows[0].user_id, leg.id]);
        } else {
          console.log(`  Deleting empty league ${leg.id}`);
          await client.query(`DELETE FROM leagues WHERE id = $1`, [leg.id]);
        }
      }

      // 3. Delete from users
      await client.query(`DELETE FROM users WHERE id = $1`, [user.id]);
      
      await client.query('COMMIT');
      console.log(`  Successfully deleted ${user.username}`);
    }
  } catch (err) {
    console.error('Cleanup failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

cleanup();
