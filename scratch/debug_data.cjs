const { Pool } = require('pg');
require('dotenv').config({ path: '/root/kickoff-bot/whatsapp-bot/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function debugBet() {
  try {
    const res = await pool.query(`
      SELECT b.*, l.name as l_name, l.bet_mode as l_mode
      FROM bets b
      LEFT JOIN leagues l ON l.id = b.league_id
      WHERE b.user_id = (SELECT id FROM users WHERE username = 'dordavid' LIMIT 1)
      ORDER BY b.placed_at DESC LIMIT 5
    `);
    console.log(JSON.stringify(res.rows, null, 2));
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
debugBet();
