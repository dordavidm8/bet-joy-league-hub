const { Pool } = require('pg');
require('dotenv').config({ path: '../backend/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkGroups() {
  try {
    const res = await pool.query(`
      SELECT g.*, l.name as league_name 
      FROM wa_groups g 
      JOIN leagues l ON l.id = g.league_id 
      WHERE g.is_active = true
    `);
    console.log('Active WA Groups:');
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkGroups();
