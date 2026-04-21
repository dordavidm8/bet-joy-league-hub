const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres:oDJLZdMzWwVBxPfrRyVoVLbYKEgeRQio@turntable.proxy.rlwy.net:59209/railway',
  ssl: false
});

async function run() {
  const code = 'TOUK12K7';
  const res = await pool.query('SELECT * FROM leagues WHERE invite_code = $1', [code]);
  const league = res.rows[0];
  console.log('League:', league.name, 'Creator ID:', league.creator_id);

  const cRes = await pool.query('SELECT username, phone_number FROM users WHERE id = $1', [league.creator_id]);
  console.log('Creator in DB:', cRes.rows[0]);
  
  process.exit(0);
}
run();
