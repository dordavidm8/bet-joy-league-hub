const { Client } = require('pg');
const client = new Client({
  connectionString: process.env.DATABASE_URL
});
async function check() {
  await client.connect();
  const res = await client.query("SELECT username, phone_number, phone_verified, wa_opt_in FROM users WHERE username = 'dordavid'");
  console.log(JSON.stringify(res.rows[0], null, 2));
  await client.end();
}
check();
