const { pool } = require('../config/database');
const { decrypt } = require('./crypto');

const CACHE_TTL_MS = 5 * 60 * 1000;
let _cache = {};   // { KEY: { value, expiresAt } }

async function getSecret(key) {
  const cached = _cache[key];
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    const res = await pool.query(
      'SELECT value_encrypted, iv, auth_tag FROM encrypted_secrets WHERE key = $1',
      [key]
    );
    if (res.rows.length > 0) {
      const value = decrypt(res.rows[0]);
      _cache[key] = { value, expiresAt: Date.now() + CACHE_TTL_MS };
      return value;
    }
  } catch (err) {
    console.warn(`[secrets] DB lookup failed for ${key}: ${err.message}`);
  }

  // Fallback to process.env
  const envVal = process.env[key];
  if (envVal) {
    _cache[key] = { value: envVal, expiresAt: Date.now() + CACHE_TTL_MS };
    return envVal;
  }
  return null;
}

function invalidateCache(key) {
  delete _cache[key];
}

function clearCache() {
  _cache = {};
}

module.exports = { getSecret, invalidateCache, clearCache };
