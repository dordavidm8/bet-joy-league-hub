
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function fixLeague() {
  try {
    const res = await pool.query("SELECT id, name FROM leagues WHERE name LIKE '%אלופות בדיקה%' LIMIT 1");
    if (!res.rows[0]) {
      console.log('League not found');
      return;
    }
    const leagueId = res.rows[0].id;
    const groupJid = '120363407310633048@g.us'; // From logs

    console.log(`Fixing league: ${res.rows[0].name} (${leagueId}) with group ${groupJid}`);

    await pool.query('UPDATE leagues SET wa_enabled = true WHERE id = $1', [leagueId]);
    await pool.query(`
      INSERT INTO wa_groups (wa_group_id, league_id, is_active)
      VALUES ($1, $2, true)
      ON CONFLICT (wa_group_id) DO UPDATE SET league_id = $2, is_active = true
    `, [groupJid, leagueId]);

    console.log('Done!');
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

fixLeague();
