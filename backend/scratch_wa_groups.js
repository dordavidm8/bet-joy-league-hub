const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:oDJLZdMzWwVBxPfrRyVoVLbYKEgeRQio@turntable.proxy.rlwy.net:59209/railway', ssl: false });
async function check() {
  const res = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'wa_groups'
  `);
  console.log(res.rows);
  const res2 = await pool.query(`
    SELECT conname, pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE conrelid = 'wa_groups'::regclass;
  `);
  console.log(res2.rows);
  process.exit(0);
}
check();
