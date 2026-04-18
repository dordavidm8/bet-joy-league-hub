'use strict';

function extractNumber(jid) {
  return jid.replace('@c.us', '').replace('@g.us', '').replace(/\D/g, '');
}

function toJid(phone) {
  return `${phone}@c.us`;
}

function normalizePhone(raw) {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0')) return '972' + digits.slice(1);
  return '972' + digits;
}

function formatHHMM(date) {
  return date.toTimeString().slice(0, 5); // "HH:MM"
}

module.exports = { extractNumber, toJid, normalizePhone, formatHHMM };
