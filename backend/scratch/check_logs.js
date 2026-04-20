require('dotenv').config();
const { Pool } = require('pg');

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('📜 Last 10 WhatsApp messages logged:');
    const res = await pool.query('SELECT * FROM wa_message_log ORDER BY created_at DESC LIMIT 10');
    console.table(res.rows.map(r => ({
      time: r.created_at,
      dir: r.direction,
      group: r.group_jid ? 'YES' : 'NO',
      msg: r.message,
      action: r.action
    })));
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
  }
}

run();
