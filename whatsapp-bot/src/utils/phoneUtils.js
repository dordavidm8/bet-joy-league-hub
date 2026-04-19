'use strict';

// '972501234567@c.us' → '972501234567'
function extractNumber(jid) {
  return jid.split('@')[0];
}

// '050-123-4567' / '0501234567' / '+972501234567' → '972501234567'
function normalizePhone(raw) {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0972')) return digits.slice(1);
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0')) return '972' + digits.slice(1);
  return '972' + digits;
}

// '972501234567' → '972501234567@c.us'
function toJid(phone) {
  return `${normalizePhone(phone)}@c.us`;
}

module.exports = { extractNumber, normalizePhone, toJid };
