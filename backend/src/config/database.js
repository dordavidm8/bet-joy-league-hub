const { Pool } = require('pg');

let pool;

if (process.env.STUB_MODE === 'true') {
  const { stubPool } = require('./stubDb');
  pool = stubPool;
  console.log('🧪 DB: stub mode (no PostgreSQL needed)');
} else {
  const dbUrl = process.env.DATABASE_URL || '';
  const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
  pool = new Pool({
    connectionString: dbUrl,
    ssl: !isLocal ? { rejectUnauthorized: false } : false,
  });
  pool.on('error', (err) => console.error('DB error:', err.message));
}

module.exports = { pool };
