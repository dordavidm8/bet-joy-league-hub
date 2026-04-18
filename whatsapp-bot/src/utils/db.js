'use strict';

const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

pool.on('error', (err) => console.error('[WA-Bot] DB pool error:', err.message));

module.exports = pool;
