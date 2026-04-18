'use strict';

const express = require('express');

function startInternalApi(client) {
  const app = express();
  app.use(express.json());

  const API_KEY = process.env.INTERNAL_API_KEY || '';

  function auth(req, res, next) {
    if (req.headers['x-internal-key'] !== API_KEY) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    next();
  }

  // POST /internal/send — DM to a phone number
  app.post('/internal/send', auth, async (req, res) => {
    const { phone, text } = req.body;
    if (!phone || !text) return res.status(400).json({ error: 'phone and text required' });
    try {
      await client.sendMessage(`${phone}@c.us`, text);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /internal/send-group
  app.post('/internal/send-group', auth, async (req, res) => {
    const { groupJid, text } = req.body;
    if (!groupJid || !text) return res.status(400).json({ error: 'groupJid and text required' });
    try {
      await client.sendMessage(groupJid, text);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /internal/create-group
  app.post('/internal/create-group', auth, async (req, res) => {
    const { name, phones } = req.body;
    if (!name || !phones?.length) return res.status(400).json({ error: 'name and phones required' });
    try {
      const contacts = phones.map(p => `${p}@c.us`);
      const result = await client.createGroup(name, contacts);
      const wa_group_id = result.gid._serialized;
      const inviteCode = await client.getInviteInfo(wa_group_id).catch(() => null);
      res.json({ wa_group_id, invite_link: inviteCode ? `https://chat.whatsapp.com/${inviteCode}` : null });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /internal/add-member
  app.post('/internal/add-member', auth, async (req, res) => {
    const { groupJid, phone } = req.body;
    if (!groupJid || !phone) return res.status(400).json({ error: 'groupJid and phone required' });
    try {
      const chat = await client.getChatById(groupJid);
      await chat.addParticipants([`${phone}@c.us`]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /internal/react
  app.post('/internal/react', auth, async (req, res) => {
    const { msgId, groupJid, emoji } = req.body;
    try {
      const chat = await client.getChatById(groupJid);
      const messages = await chat.fetchMessages({ limit: 50 });
      const target = messages.find(m => m.id._serialized === msgId);
      if (target) await target.react(emoji || '👍');
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Health
  app.get('/health', (_, res) => res.json({ ok: true }));

  const PORT = process.env.BOT_INTERNAL_PORT || 4001;
  app.listen(PORT, '127.0.0.1', () => {
    console.log(`[WA] Internal API listening on port ${PORT}`);
  });
}

module.exports = { startInternalApi };
