'use strict';

const { pool } = require('../utils/db');

async function getState(phone) {
  const res = await pool.query(
    `SELECT state, context, last_msg_at FROM wa_sessions WHERE phone = $1`, [phone]
  );
  if (!res.rows[0]) return { state: 'idle', context: {} };
  // Auto-expire after 30 minutes
  const lastMsg = new Date(res.rows[0].last_msg_at);
  if (Date.now() - lastMsg.getTime() > 30 * 60 * 1000) {
    await clearState(phone);
    return { state: 'idle', context: {} };
  }
  return { state: res.rows[0].state, context: res.rows[0].context };
}

async function setState(phone, state, context = {}) {
  await pool.query(
    `INSERT INTO wa_sessions (phone, state, context, last_msg_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (phone) DO UPDATE SET state=$2, context=$3, last_msg_at=NOW()`,
    [phone, state, JSON.stringify(context)]
  );
}

async function clearState(phone) {
  await pool.query(
    `INSERT INTO wa_sessions (phone, state, context, last_msg_at)
     VALUES ($1, 'idle', '{}', NOW())
     ON CONFLICT (phone) DO UPDATE SET state='idle', context='{}', last_msg_at=NOW()`,
    [phone]
  );
}

module.exports = { getState, setState, clearState };
