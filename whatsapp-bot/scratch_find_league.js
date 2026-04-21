const { pool } = require('./src/utils/db');
(async () => {
  try {
    const res = await pool.query("SELECT id, name FROM leagues WHERE name LIKE '%ניסיון לה ליגה%'");
    console.log(JSON.stringify(res.rows));
  } catch (err) {
    console.error(err.message);
  }
  process.exit(0);
})();
