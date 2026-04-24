/**
 * utils/db.js – חיבור PostgreSQL של הבוט
 *
 * connection pool ל-PostgreSQL (אותו DB כמו הבאקנד הראשי).
 * DATABASE_URL מגיע מ-env var.
 */
'use strict';
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 5,
});

module.exports = { pool };
