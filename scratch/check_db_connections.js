const { pool } = require('./backend/src/config/database');

async function checkConnections() {
  try {
    const res = await pool.query('SELECT count(*) FROM pg_stat_activity');
    console.log('Total connections:', res.rows[0].count);
    
    const res2 = await pool.query("SELECT count(*) FROM pg_stat_activity WHERE state = 'active'");
    console.log('Active queries:', res2.rows[0].count);

    const res3 = await pool.query("SELECT pid, query, state, duration FROM (SELECT pid, query, state, now() - query_start AS duration FROM pg_stat_activity WHERE state != 'idle') AS active_queries");
    console.log('Active queries details:', res3.rows);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkConnections();
