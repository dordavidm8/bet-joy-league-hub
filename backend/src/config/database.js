/**
 * database.js – חיבור PostgreSQL
 *
 * יוצר ומייצא connection pool (pg.Pool) לפי DATABASE_URL.
 * במצב STUB_MODE מחזיר stubDb במקום.
 * Pool מנהל עד 10 חיבורים במקביל.
 */
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
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000, // 10s query limit
  });
  pool.on('error', (err) => console.error('DB error:', err.message));
}

module.exports = { pool };
