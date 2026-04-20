'use strict';
const os = require('os');
const { pool } = require('./utils/db');

const DEVELOPER_NUMBER = '972526980000@c.us';

function getMemoryUsage() {
  const used = process.memoryUsage();
  return `${Math.round(used.rss / 1024 / 1024)} MB`;
}

async function getHealthStatus() {
  let dbStatus = '✅';
  let faults = [];
  try { await pool.query('SELECT 1'); } catch (e) { 
    dbStatus = '❌'; 
    faults.push(`DB Error: ${e.message}`);
  }

  // Check for stuck pending messages (> 1 hour)
  try {
    const stuckRes = await pool.query(`SELECT COUNT(*) FROM wa_pending_messages WHERE sent = false AND created_at < NOW() - INTERVAL '1 hour'`);
    const stuckCount = parseInt(stuckRes.rows[0].count);
    if (stuckCount > 0) {
      faults.push(`${stuckCount} pending messages stuck for >1 hour`);
    }
  } catch (e) {}

  return `📊 *KickOff Bot Status Report*
Memory: ${getMemoryUsage()}
DB: ${dbStatus}
Uptime: ${Math.round(process.uptime() / 60)} mins
OS: ${os.platform()} (${os.release()})
Load: ${os.loadavg().map(l => l.toFixed(1)).join(', ')}
Detected Faults: ${faults.length > 0 ? faults.join(', ') : 'None ✅'}`;
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
      const report = await getHealthStatus();
      try {
        await client.sendMessage(DEVELOPER_NUMBER, `🔄 *Scheduled Restart*
Reason: Periodic health maintenance (3,7,11...)
${report}`);
      } catch (e) {
        console.error('[Health] Failed to send restart report:', e.message);
      }
      
      console.log('[Health] Scheduled restart triggering...');
      // Wait a bit for message to send
      setTimeout(() => process.exit(0), 5000);
    }
  }, 60000);
}

module.exports = { startHealthChecks, getHealthStatus, DEVELOPER_NUMBER };
