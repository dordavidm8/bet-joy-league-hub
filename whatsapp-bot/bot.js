'use strict';

require('dotenv').config({ path: '../backend/.env' });

const { startInternalApi } = require('./src/internalApi');
const { startScheduledJobs } = require('./src/scheduledJobs');
const { handleGroupMessage } = require('./src/handlers/groupHandler');
const { handleDMMessage } = require('./src/handlers/dmHandler');

// ── WhatsApp Client ────────────────────────────────────────────────────────────
// whatsapp-web.js is installed but requires a real phone number to authenticate.
// When BOT_PHONE is set, the real client is initialised.
// Until then, a stub client is used so all other infrastructure can run.

let client;

const BOT_PHONE = process.env.BOT_PHONE;

if (BOT_PHONE) {
  // Real client — uncomment and install whatsapp-web.js when phone is ready
  const { Client, LocalAuth } = require('whatsapp-web.js');
  const qrcode = require('qrcode-terminal');

  client = new Client({
    authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    },
  });

  client.on('qr', (qr) => {
    console.log('[WA] Scan QR to authenticate:');
    qrcode.generate(qr, { small: true });
  });

  client.on('authenticated', () => console.log('[WA] Authenticated'));
  client.on('auth_failure', (msg) => console.error('[WA] Auth failure:', msg));
  client.on('ready', () => {
    console.log('[WA] Client ready');
    startScheduledJobs(client);
    startInternalApi(client);
  });
  client.on('disconnected', (reason) => {
    console.warn('[WA] Disconnected:', reason);
    setTimeout(() => client.initialize(), 10_000);
  });

  client.on('message', async (msg) => {
    try {
      const isGroup = msg.from.endsWith('@g.us');
      if (isGroup) {
        await handleGroupMessage(client, msg);
      } else {
        await handleDMMessage(client, msg);
      }
    } catch (err) {
      console.error('[WA] Message handler error:', err.message);
    }
  });

  client.initialize();
} else {
  // ── STUB CLIENT — all features work except actual WhatsApp I/O ───────────────
  console.log('[WA] No BOT_PHONE set. Running in STUB mode — infrastructure only.');
  console.log('[WA] Set BOT_PHONE env variable and restart to enable WhatsApp.');

  client = {
    sendMessage: async (jid, text) => {
      console.log(`[WA-STUB] sendMessage → ${jid}: ${text.slice(0, 80)}...`);
      return { id: { _serialized: `stub-${Date.now()}` } };
    },
    createGroup: async (name) => {
      console.log(`[WA-STUB] createGroup: ${name}`);
      return { gid: { _serialized: `stub-group-${Date.now()}@g.us` } };
    },
    getChatById: async () => ({ participants: [], addParticipants: async () => {} }),
    getInviteInfo: async () => null,
  };

  startScheduledJobs(client);
  startInternalApi(client);

  console.log('[WA] Stub bot running. Internal API and cron jobs active.');
}
