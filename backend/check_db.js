const { Pool } = require('pg');
require('dotenv').config({ path: './.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function check() {
  try {
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('Tables:', res.rows.map(r => r.table_name).join(', '));
    
    const games = await pool.query('SELECT COUNT(*) FROM games');
    console.log('Games count:', games.rows[0].count);
    
    const users = await pool.query('SELECT COUNT(*) FROM users');
    console.log('Users count:', users.rows[0].count);
    
    process.exit(0);
  } catch (err) {
    console.error('DB Error:', err.message);
    process.exit(1);
  }
}

check();
