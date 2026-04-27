const Redis = require('ioredis');

let redis = null;

if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 5000,
    lazyConnect: false,
  });

  redis.on('connect', () => console.log('[redis] connected'));
  redis.on('error', (err) => console.warn('[redis] error:', err.message));
}

async function get(key) {
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function set(key, value, ttlSeconds) {
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {}
}

async function del(key) {
  if (!redis) return;
  try {
    await redis.del(key);
  } catch {}
}

module.exports = { get, set, del };
