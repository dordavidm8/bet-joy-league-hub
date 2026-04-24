/**
 * rateLimiter.js – הגבלת קצב הודעות
 *
 * מגביל מספר הודעות:
 *   - לפי מספר טלפון (per user)
 *   - לפי קבוצה (per group)
 * מונע spam ושימוש לרעה בבוט.
 */
'use strict';

// Simple in-memory rate limiter: 10 commands/minute per JID
const map = new Map(); // jid → { count, resetAt }

function isRateLimited(jid) {
  const now = Date.now();
  let entry = map.get(jid);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + 60_000 };
    map.set(jid, entry);
  }
  entry.count++;
  return entry.count > 10;
}

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of map) {
    if (now > v.resetAt) map.delete(k);
  }
}, 5 * 60 * 1000);

module.exports = { isRateLimited };
