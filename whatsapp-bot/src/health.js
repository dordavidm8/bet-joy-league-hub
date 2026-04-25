/**
 * health.js – בדיקת בריאות הבוט
 *
 * GET /health – מחזיר: { status: 'connected'/'disconnected', ... }
 * נקרא מהבאקנד ב-GET /api/whatsapp/health.
 */
'use strict';
const os = require('os');
const { pool } = require('./utils/db');

const DEVELOPER_NUMBER = '972526980000@c.us';

function getMemoryUsage() {
  const used = process.memoryUsage();
  return `${Math.round(used.rss / 1024 / 1024)} MB`;
}

async function getHealthStatus() {
  const mem = process.memoryUsage();
  const totalRamMB = Math.round(os.totalmem() / 1024 / 1024);
  const usedRamMB = Math.round((os.totalmem() - os.freemem()) / 1024 / 1024);
  const ramPct = ((usedRamMB / totalRamMB) * 100).toFixed(1);
  const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
  const heapPct = ((heapUsedMB / heapTotalMB) * 100).toFixed(1);
  const rssMB = Math.round(mem.rss / 1024 / 1024);
  const rssPct = ((rssMB / totalRamMB) * 100).toFixed(1);

  const now = new Date().toLocaleString('he-IL', { 
    timeZone: 'Asia/Jerusalem', 
    day: '2-digit', month: '2-digit', year: 'numeric', 
    hour: '2-digit', minute: '2-digit', second: '2-digit' 
  }).replace(/\//g, '.');

  return `📊 *סטטוס בוט (DerbyUp)*
🟢 פעיל
📅 *תאריך ושעה:* ${now}

🖥️ זיכרון מערכת: ${usedRamMB}MB / ${totalRamMB}MB (${ramPct}%)
🧠 זיכרון תהליך (Heap): ${heapUsedMB}MB / ${heapTotalMB}MB (${heapPct}%)
📦 RSS (זיכרון פיזי): ${rssMB}MB / ${totalRamMB}MB (${rssPct}%)`;
}

function startHealthChecks(client) {
  // Restart every 4 hours at 3, 7, 11, 15, 19, 23
  const restartTimes = [3, 7, 11, 15, 19, 23];
  
  console.log('[Health] Health checks and scheduled restarter active ✅');

  setInterval(async () => {
    const now = new Date();
    // Normalize to Israel time
    const ilTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
    const hours = ilTime.getHours();
    const minutes = ilTime.getMinutes();
    
    if (restartTimes.includes(hours) && minutes === 0) {
      console.log('[Health] Scheduled restart triggering...');
      // Wait bit then exit. The bot will send a "Started" message upon reboot anyway.
      setTimeout(() => process.exit(0), 5000);
    }
  }, 60000);
}

module.exports = { startHealthChecks, getHealthStatus, DEVELOPER_NUMBER };
