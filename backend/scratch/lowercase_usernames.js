require('dotenv').config();
const { Pool } = require('pg');

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('🔄 Converting all usernames to lowercase...');
    const res = await pool.query('UPDATE users SET username = LOWER(username) WHERE username != LOWER(username) RETURNING id, username');
    console.log(`✅ Updated ${res.rowCount} users.`);
    res.rows.forEach(r => console.log(` - ${r.username}`));
  } catch (err) {
    console.error('❌ Failed:', err.message);
  } finally {
    await pool.end();
  }
}

run();
