'use strict';

const express = require('express');
const { pool } = require('./utils/db');

const INTERNAL_KEY = process.env.INTERNAL_API_KEY || '';
const PORT = parseInt(process.env.BOT_INTERNAL_PORT || '4001', 10);

function auth(req, res, next) {
  if (req.headers['x-internal-key'] !== INTERNAL_KEY || !INTERNAL_KEY) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

function toJid(phone) {
  // normalize to JID: 972XXXXXXXXX@c.us
  const digits = phone.replace(/\D/g, '');
  return `${digits}@c.us`;
}

function startInternalApi(client) {
  const app = express();
  app.use(express.json());

  // Global logger
  app.use((req, res, next) => {
    console.log(`[WA] Incoming ${req.method} ${req.path}`);
    next();
  });

  // POST /internal/send — DM to phone number
  app.post('/internal/send', auth, async (req, res) => {
    const { phone, text } = req.body;
    if (!phone || !text) return res.status(400).json({ error: 'phone and text required' });
    try {
      await client.sendMessage(toJid(phone), text);
      res.json({ ok: true });
    } catch (err) {
      console.error('[internal/send]', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /internal/send-group — message to group JID
  app.post('/internal/send-group', auth, async (req, res) => {
    const { groupJid, text } = req.body;
    if (!groupJid || !text) return res.status(400).json({ error: 'groupJid and text required' });
    try {
      await client.sendMessage(groupJid, text);
      res.json({ ok: true });
    } catch (err) {
      console.error('[internal/send-group]', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  async function setupGroup(chat, inviteCode) {
    let invite_link = null;
    // 1. Get invite link immediately so the UI can update
    try {
      const code = await chat.getInviteCode();
      invite_link = `https://chat.whatsapp.com/${code}`;
      console.log(`[WA] Initial link fetch: ${invite_link}`);
    } catch (e) {
      console.error(`[WA] Initial link fetch FAIL: ${e.message}`);
    }

    // 2. Perform everything else in background to avoid blocking the API
    (async () => {
      try {
        console.log(`[WA] Starting background setup for group ${chat.id._serialized}`);
        
        // Wait 10s for initial sync before permissions
        await new Promise(r => setTimeout(r, 10000));
        
        await chat.setMessagesAdminsOnly(false).catch(() => {});
        await chat.setInfoAdminsOnly(false).catch(() => {});
        if (chat.setAddMembersAdminsOnly) await chat.setAddMembersAdminsOnly(false).catch(() => {});
        else if (chat.setAddParticipantsAdminsOnly) await chat.setAddParticipantsAdminsOnly(false).catch(() => {});
        
        console.log(`[WA] Background: Sync and permissions set`);

        // Wait another 50s (total 60s) before description
        await new Promise(r => setTimeout(r, 50000));
        
        if (inviteCode) {
          const description = `ברוכים הבאים לליגת Kickoff! ⚽\nלהצטרפות ישירה וליצירת חשבון:\nhttps://kickoff-bet.app/leagues?join=${inviteCode}`;
          await chat.setDescription(description).catch(e => {
            console.warn(`[WA] Description background update FAIL: ${e.message}`);
          });
          console.log(`[WA] Background: Description set`);
        }
      } catch (err) {
        console.error('[WA] Background setup block CRASH:', err.message);
      }
    })();

    return invite_link;
  }

  // POST /internal/create-group — create a new WA group
  app.post('/internal/create-group', auth, async (req, res) => {
    const { name, phones, leagueId, inviteCode } = req.body;
    if (!name || !phones?.length) return res.status(400).json({ error: 'name and phones required' });
    try {
      const participants = phones.map(toJid);
      console.log(`[WA] Attempting to create group "${name}" with participants:`, participants);

      const result = await client.createGroup(name, participants);
      const groupJid = result.gid?._serialized || result.gid;
      console.log(`[WA] Group created: ${groupJid}`);
      
      if (result.participants) {
        Object.entries(result.participants).forEach(([jid, status]) => {
          console.log(`[WA] Participant ${jid} status: ${status.code}`);
        });
      }

      const invite_link = await setupGroup(await client.getChatById(groupJid), inviteCode);
      res.json({ wa_group_id: groupJid, invite_link });
    } catch (err) {
      console.error('[WA] create-group FAIL:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /internal/get-invite-link — get invite link for existing group
  app.post('/internal/get-invite-link', auth, async (req, res) => {
    const { groupJid, inviteCode } = req.body;
    if (!groupJid) return res.status(400).json({ error: 'groupJid required' });
    try {
      const chat = await client.getChatById(groupJid);
      const invite_link = await setupGroup(chat, inviteCode);
      res.json({ invite_link });
    } catch (err) {
      console.error('[internal/get-invite-link]', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /internal/add-member — add participant to group
  app.post('/internal/add-member', auth, async (req, res) => {
    const { groupJid, phone } = req.body;
    if (!groupJid || !phone) return res.status(400).json({ error: 'groupJid and phone required' });
    try {
      const chat = await client.getChatById(groupJid);
      await chat.addParticipants([toJid(phone)]);
      res.json({ ok: true });
    } catch (err) {
      console.error('[internal/add-member]', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /internal/react — react to message
  app.post('/internal/react', auth, async (req, res) => {
    const { msgId, groupJid, emoji } = req.body;
    if (!msgId || !emoji) return res.status(400).json({ error: 'msgId and emoji required' });
    try {
      const chat = await client.getChatById(groupJid);
      const msgs = await chat.fetchMessages({ limit: 50 });
      const target = msgs.find(m => m.id._serialized === msgId);
      if (target) await target.react(emoji);
      res.json({ ok: true });
    } catch (err) {
      console.error('[internal/react]', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Flush pending messages from DB (called after bot reconnects)
  app.post('/internal/flush-pending', auth, async (req, res) => {
    try {
      const rows = await pool.query(
        `SELECT id, phone, group_jid, text FROM wa_pending_messages WHERE sent = false ORDER BY created_at LIMIT 50`
      );
      let sent = 0;
      for (const row of rows.rows) {
        try {
          const jid = row.group_jid || toJid(row.phone);
          await client.sendMessage(jid, row.text);
          await pool.query(`UPDATE wa_pending_messages SET sent = true WHERE id = $1`, [row.id]);
          sent++;
        } catch {}
      }
      res.json({ flushed: sent });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /internal/broadcast-league — manually trigger morning broadcast for a league
  app.post('/internal/broadcast-league', auth, async (req, res) => {
    const { leagueId } = req.body;
    if (!leagueId) return res.status(400).json({ error: 'leagueId required' });
    try {
      const { sendMorningMessages } = require('./notifications/morningMessages');
      const leagueRes = await pool.query(
        `SELECT wls.*, wg.wa_group_id, l.name AS league_name, l.id AS league_id_val, l.is_tournament, l.tournament_slug
         FROM wa_league_settings wls
         JOIN wa_groups wg ON wg.league_id = wls.league_id AND wg.is_active = true
         JOIN leagues l ON l.id = wls.league_id
         WHERE l.id = $1`,
        [leagueId]
      );
      sendMorningMessages(client, leagueRes.rows[0]).catch((err) => {
        console.error('[broadcast-league] background error:', err.message);
      });
      res.json({ ok: true, message: 'Broadcast triggered' });
    } catch (err) {
      console.error('[internal/broadcast-league]', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.listen(PORT, () => {
    console.log(`[WA] Internal API מאזין על port ${PORT}`);
  });
}

module.exports = { startInternalApi };
