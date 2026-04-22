const { Pool } = require('pg');
require('dotenv').config({ path: '/root/kickoff-bot/whatsapp-bot/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'bets'")
  .then(r => { console.log(r.rows.map(x => x.column_name)); process.exit(0); })
  .catch(e => { console.error(e); process.exit(1); });
