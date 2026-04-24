/**
 * bot.js – נקודת כניסה של בוט WhatsApp
 *
 * מאתחל לקוח whatsapp-web.js (Puppeteer/Chrome headless).
 * מציג QR בהפעלה ראשונה לסריקה. session נשמרת ב-.wwebjs_auth/.
 *
 * אירועים:
 *   ready    – הבוט מחובר, מפעיל jobs, שולח הודעה למפתח
 *   message  – מפנה לgroupHandler או dmHandler
 *   qr       – מציג QR לסריקה בטרמינל
 *
 * שרת פנימי: port 4001 דרך internalApi.js (backend → bot HTTP).
 * שרת PM2: מנוהל על ידי ecosystem.config.js על VPS (IONOS).
 */
'use strict';
require('dotenv').config();

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { startInternalApi } = require('./src/internalApi');
const { startScheduledJobs } = require('./src/scheduledJobs');
const { handleGroupMessage } = require('./src/handlers/groupHandler');
const { handleDmMessage } = require('./src/handlers/dmHandler');
const { pool } = require('./src/utils/db');
const { startHealthChecks, DEVELOPER_NUMBER } = require('./src/health');

const fs = require('fs');
if (!fs.existsSync('.wwebjs_auth/session') && fs.existsSync('.wwebjs_auth_seed/session')) {
  console.log('[WA] מעתיק קובץ הזדהות ראשוני אל השרת...');
  fs.cpSync('.wwebjs_auth_seed', '.wwebjs_auth', { recursive: true });
}

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
  webVersionCache: {
    type: 'remote',
    remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
  },
  puppeteer: {
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  },
});

// ── QR ──────────────────────────────────────────────────────────────────────
client.on('qr', (qr) => {
  console.log('[WA] סרוק את הQR:');
  qrcode.generate(qr, { small: true });
});

// ── Ready ────────────────────────────────────────────────────────────────────
client.on('ready', async () => {
  console.log('[WA] הבוט מחובר ✅');
  console.log('[WA] My Number: ' + client.info.wid.user);
  startInternalApi(client);
  startScheduledJobs(client);
  startHealthChecks(client);

  // Auto-migration
  pool.query('ALTER TABLE bets ADD COLUMN IF NOT EXISTS wa_confirmation_message_id TEXT').catch(e => {
    console.error('[WA-DB] Migration error:', e.message);
  });
  
  // Notify developer of startup
  try {
    const { getHealthStatus } = require('./src/health');
    const status = await getHealthStatus();
    await client.sendMessage(DEVELOPER_NUMBER, `✅ *הבוט הופעל/אותחל מחדש*\n\n${status}`);
  } catch (e) {}
});

// ── Auth failure ─────────────────────────────────────────────────────────────
client.on('auth_failure', (msg) => {
  console.error('[WA] שגיאת אימות:', msg);
});

client.on('disconnected', (reason) => {
  console.warn('[WA] התנתק:', reason);
  setTimeout(() => client.initialize(), 5000);
});

// ── Messages ──────────────────────────────────────────────────────────────────
client.on('message', async (msg) => {
  // Ignore messages sent by the bot itself
  if (msg.fromMe) return;
  // Ignore system/ACK messages with no text content
  if (!msg.body || !msg.body.trim()) return;

  try {
    const chat = await msg.getChat();
    if (chat.isGroup) {
      await handleGroupMessage(client, msg, chat);
    } else {
      await handleDmMessage(client, msg);
    }
  } catch (err) {
    console.error('[WA] שגיאה בטיפול בהודעה:', err.message);
  }
});

client.initialize();
