const { Pool } = require('pg');

let pool;

if (process.env.STUB_MODE === 'true') {
  const { stubPool } = require('./stubDb');
  pool = stubPool;
  console.log('🧪 DB: stub mode (no PostgreSQL needed)');
} else {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  pool.on('error', (err) => console.error('DB error:', err.message));
}

module.exports = { pool };
