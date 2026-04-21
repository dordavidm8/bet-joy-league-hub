const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:oDJLZdMzWwVBxPfrRyVoVLbYKEgeRQio@turntable.proxy.rlwy.net:59209/railway', ssl: false });
async function migrate() {
  await pool.query('ALTER TABLE wa_groups DROP CONSTRAINT IF EXISTS wa_groups_wa_group_id_key');
  await pool.query('ALTER TABLE wa_groups ADD CONSTRAINT wa_groups_wa_group_id_league_id_key UNIQUE (wa_group_id, league_id)');
  console.log('Migrated constraint');
  process.exit(0);
}
migrate();
