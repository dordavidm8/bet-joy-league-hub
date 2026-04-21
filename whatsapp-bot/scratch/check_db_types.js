const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  const res = await pool.query(`
    select table_name, column_name, data_type 
    from information_schema.columns 
    where (table_name = 'users' and column_name = 'points_balance')
       or (table_name = 'bets' and column_name = 'potential_payout')
       or (table_name = 'league_members' and column_name = 'points_in_league')
  `);
  console.log(JSON.stringify(res.rows, null, 2));
  process.exit(0);
}
check();
