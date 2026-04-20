'use strict';
require('dotenv').config();

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { startInternalApi } = require('./src/internalApi');
const { startScheduledJobs } = require('./src/scheduledJobs');
const { handleGroupMessage } = require('./src/handlers/groupHandler');
const { handleDmMessage } = require('./src/handlers/dmHandler');

const fs = require('fs');
if (!fs.existsSync('.wwebjs_auth/session') && fs.existsSync('.wwebjs_auth_seed/session')) {
  console.log('[WA] מעתיק קובץ הזדהות ראשוני אל השרת...');
  fs.cpSync('.wwebjs_auth_seed', '.wwebjs_auth', { recursive: true });
}

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
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
client.on('ready', () => {
  console.log('[WA] הבוט מחובר ✅');
  console.log('[WA] My Number: ' + client.info.wid.user);
  startInternalApi(client);
  startScheduledJobs(client);
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
client.on('message_create', async (msg) => {
  // Ignore messages sent by the bot itself
  if (msg.fromMe) return;

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
