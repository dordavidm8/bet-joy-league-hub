const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url || url.includes('הדבק_כאן')) {
    console.error('❌ Error: DATABASE_URL is not defined or is placeholder.');
    console.log('Usage: DATABASE_URL=postgresql://... node src/db/patch_v2.js');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const targetFile = process.argv[2] || '2026C_agents_v2.sql';
    const filePath = targetFile.includes('/') ? targetFile : path.join(__dirname, 'migrations', targetFile);
    
    console.log(`⏳ Running migration: ${filePath}...`);
    if (!fs.existsSync(filePath)) {
        console.error('❌ SQL file not found at:', filePath);
        process.exit(1);
    }
    const sql = fs.readFileSync(filePath, 'utf8');
    
    // Split by semicolon, filter out empty lines/comments
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📦 Found ${statements.length} SQL statements. Executing...`);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const statement of statements) {
        await client.query(statement);
      }
      await client.query('COMMIT');
      console.log('✅ Migration applied successfully!');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

run();
