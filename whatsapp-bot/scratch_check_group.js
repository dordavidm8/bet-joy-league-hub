const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const jid = '120363427611433740@g.us';
  console.log(`Checking JID: ${jid}`);
  
  const res = await pool.query('SELECT * FROM wa_groups WHERE wa_group_id = $1', [jid]);
  if (res.rows.length === 0) {
    console.log('❌ Group NOT found in wa_groups table.');
  } else {
    console.log('✅ Group found:', res.rows[0]);
  }
  
  const allGroups = await pool.query('SELECT * FROM wa_groups LIMIT 5');
  console.log('Sample of existing groups:', allGroups.rows);
  
  await pool.end();
}

check();
