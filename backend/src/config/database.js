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
// Main App Pool (original)
const dbUrl = process.env.DATABASE_URL || '';
const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
pool = new Pool({
  connectionString: dbUrl,
  ssl: !isLocal ? { rejectUnauthorized: false } : false,
});
pool.on('error', (err) => console.error('DB error:', err.message));

// Isolated Agents Pool (for AI stuff)
const agentsDbUrl = process.env.AGENTS_DATABASE_URL || dbUrl;
const isAgentsIsolated = !!process.env.AGENTS_DATABASE_URL;
if (!isAgentsIsolated) {
  console.warn('⚠️ AGENTS_DATABASE_URL not set. Using primary database for agents (No Isolation).');
} else {
  console.log('🛡️ Agents database isolated via AGENTS_DATABASE_URL');
}

const agentsPool = isAgentsIsolated ? new Pool({
  connectionString: agentsDbUrl,
  ssl: { rejectUnauthorized: false }
}) : pool;

if (isAgentsIsolated) {
  agentsPool.on('error', (err) => console.error('Agents Pool error:', err.message));
}

module.exports = { pool, agentsPool };
