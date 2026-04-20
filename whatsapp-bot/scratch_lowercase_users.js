const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function updateUsers() {
  console.log('Updating all usernames to lowercase...');
  const res = await pool.query('UPDATE users SET username = LOWER(username) RETURNING username');
  console.log(`Updated ${res.rowCount} users.`);
  await pool.end();
}

updateUsers();
