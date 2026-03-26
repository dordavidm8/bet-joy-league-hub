const { Pool } = require('pg');
require('dotenv').config({ path: './.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function check() {
  try {
    const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log('--- TABLES ---');
    console.log(tables.rows.map(r => r.table_name).join(', '));

    for (const table of ['users', 'games', 'daily_mini_games', 'bets']) {
        try {
            const res = await pool.query(`SELECT COUNT(*) FROM ${table}`);
            console.log(`${table} count: ${res.rows[0].count}`);
            if (res.rows[0].count > 0) {
               const data = await pool.query(`SELECT * FROM ${table} LIMIT 1`);
               console.log(`Sample ${table}:`, JSON.stringify(data.rows[0], null, 2));
            }
        } catch (e) {
            console.log(`${table} error: ${e.message}`);
        }
    }
    process.exit(0);
  } catch (err) {
    console.error('CRITICAL ERROR:', err.message);
    process.exit(1);
  }
}

check();
