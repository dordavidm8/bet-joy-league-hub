/**
 * internalApi.js – API פנימי (port 4001)
 *
 * Express server שמקבל בקשות מהבאקנד הראשי.
 * Endpoint: POST /send-message – שולח הודעה WhatsApp.
 * מאובטח עם x-api-key header (INTERNAL_API_KEY env var).
 */
'use strict';

const express = require('express');
const { pool } = require('./utils/db');

const pendingSetups = new Set();

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

  async function setupGroup(chat, inviteCode, leagueName, leagueId) {
    const groupJid = chat.id._serialized;
    if (pendingSetups.has(groupJid)) {
      console.log(`[WA] Setup already in progress for ${groupJid}, skipping...`);
      return null;
    }
    pendingSetups.add(groupJid);

    let invite_link = null;

    // 0. Permission check: Can we send messages?
    const canSend = chat.canSendMessages;
    if (canSend === false) {
      console.warn(`[WA] Bot cannot send messages in ${groupJid}`);
      return { error: 'לבוט אין הרשאות לשליחת הודעות בקבוצה זו. אנא וודאו שהוא מוגדר כמנהל או שהקבוצה פתוחה לכולם.' };
    }

    // 1. Link league in DB immediately
    if (leagueId) {
      try {
        await pool.query('UPDATE leagues SET wa_enabled = true WHERE id = $1', [leagueId]);
        await pool.query(
          `INSERT INTO wa_groups (wa_group_id, league_id, is_active) VALUES ($1, $2, true) 
           ON CONFLICT (wa_group_id) DO UPDATE SET league_id = $2, is_active = true`,
          [groupJid, leagueId]
        );
        console.log(`[WA] League ${leagueId} linked to ${groupJid}`);
      } catch (e) {
        console.error(`[WA] DB link FAIL: ${e.message}`);
      }
    }

    // 2. Get invite link immediately so the UI can update
    try {
      const code = await chat.getInviteCode();
      invite_link = `https://chat.whatsapp.com/${code}`;
      console.log(`[WA] Initial link fetch: ${invite_link}`);
      if (invite_link && leagueId) {
        await pool.query(`UPDATE wa_groups SET invite_link = $1 WHERE wa_group_id = $2 AND league_id = $3`, [invite_link, groupJid, leagueId]);
      }
    } catch (e) {
      console.warn(`[WA] Initial link fetch FAIL: ${e.message}`);
    }

    // 2. Perform everything else in background
    (async () => {
      try {
        console.log(`[WA] Starting background setup for group ${groupJid}`);
        
        // Wait 3s instead of 10s
        await new Promise(r => setTimeout(r, 3000));
        
        // Retry invite link if we missed it
        if (!invite_link) {
          try {
            const code = await chat.getInviteCode();
            invite_link = `https://chat.whatsapp.com/${code}`;
            await pool.query(`UPDATE wa_groups SET invite_link = $1 WHERE wa_group_id = $2`, [invite_link, groupJid]);
            console.log(`[WA] Background: Invite link recovered and saved: ${invite_link}`);
          } catch (e) {
            console.error(`[WA] Background link retry FAIL: ${e.message}`);
          }
        }

        // Apply settings
        await chat.setMessagesAdminsOnly(false).catch(e => console.warn(`[WA] setMessagesAdminsOnly FAIL: ${e.message}`));
        await chat.setInfoAdminsOnly(false).catch(e => console.warn(`[WA] setInfoAdminsOnly FAIL: ${e.message}`));
        if (chat.setAddMembersAdminsOnly) await chat.setAddMembersAdminsOnly(false).catch(() => {});
        else if (chat.setAddParticipantsAdminsOnly) await chat.setAddParticipantsAdminsOnly(false).catch(() => {});
        
        console.log(`[WA] Background: Permissions set`);

        // Wait only 2s before description
        await new Promise(r => setTimeout(r, 2000));
        
        if (inviteCode && leagueId) {
          const description = `ברוכים הבאים לליגת DerbyUp! ⚽\nלהצטרפות ישירה וליצירת חשבון:\nhttps://derbyup.bet/leagues/${leagueId}`;
          await chat.setDescription(description).catch(e => {
            console.warn(`[WA] Description background update FAIL: ${e.message}`);
          });
          console.log(`[WA] Background: Description set`);
        }

        // Wait 2 seconds and send the final welcome message
        await new Promise(r => setTimeout(r, 2000));
        const welcomeText = `ברוכים הבאים לליגת *${leagueName || 'DerbyUp'}*! ⚽\n\n` +
          `*כללי המשחק:*\n` +
          `בכל בוקר יישלחו לקבוצה הודעות על משחקי היום הבא. על מנת להמר על המשחק יש להגיב להודעה עם המנצחת (1/2/X) והתוצאה המדויקת.\n` +
          `בסיום כל משחק יישלחו התוצאות והניקוד שהרוויח כל משתתף.\n` +
          `רוצים לראות את הטבלה העדכנית? תכתבו *"שלח טבלה גבר"*.\n\n` +
          `יאללה, מי שעוד לא חיבר את המשתמש שלו לווטסאפ - זה הזמן.\n` +
          `אתר הליגה:\n` +
          `https://derbyup.bet/leagues/${leagueId}\n\n` +
          `שיהיה בהצלחה! 🏆`;
        
        await chat.sendMessage(welcomeText);
        console.log(`[WA] Background: Welcome message sent`);
      } catch (err) {
        console.error('[WA] Background setup block CRASH:', err.message);
      } finally {
        pendingSetups.delete(groupJid);
      }
    })();

    return { invite_link, can_send: true };
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

      let chat = null;
      for (let i = 0; i < 5; i++) {
        try {
          chat = await client.getChatById(groupJid);
          if (chat) break;
        } catch (e) {
          console.warn(`[WA] getChatById attempt ${i+1} FAIL: ${e.message}`);
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      if (!chat) throw new Error('Could not find created group chat object');

      const leagueName = req.body.leagueName;
      const result_setup = await setupGroup(chat, inviteCode, leagueName, leagueId);
      res.json({ wa_group_id: groupJid, ...result_setup });
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

  // POST /internal/join-group-by-link — bot joins via link
  app.post('/internal/join-group-by-link', auth, async (req, res) => {
    const { link, leagueId, inviteCode, leagueName } = req.body;
    if (!link || !leagueId) return res.status(400).json({ error: 'link and leagueId required' });
    try {
      const inviteCodeWA = link.replace('https://chat.whatsapp.com/', '').split('?')[0].trim();
      const groupJid = await client.acceptInvite(inviteCodeWA);
      console.log(`[WA] Joined group via link: ${groupJid}`);
      
      await new Promise(r => setTimeout(r, 2000)); // allow chat sync
      
      // Setup
      const result_setup = await setupGroup(await client.getChatById(groupJid), inviteCode, leagueName, leagueId);
      
      // If we joined via link, ensure the link we joined with is saved as the group link
      if (link && !result_setup.invite_link) {
        await pool.query(`UPDATE wa_groups SET invite_link = $1 WHERE wa_group_id = $2`, [link, groupJid]);
        result_setup.invite_link = link;
      }
      
      res.json({ wa_group_id: groupJid, ...result_setup });
    } catch (err) {
      console.error('[internal/join-group-by-link]', err.message);
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

  // POST /internal/leave-group
  app.post('/internal/leave-group', auth, async (req, res) => {
    const { groupJid } = req.body;
    if (!groupJid) return res.status(400).json({ error: 'groupJid required' });
    try {
      const chat = await client.getChatById(groupJid);
      await chat.leave();
      res.json({ ok: true });
    } catch (err) {
      console.error('[internal/leave-group]', err.message);
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
        `SELECT wg.wa_group_id, l.name AS league_name, l.id AS league_id_val, l.is_tournament, l.tournament_slug, wls.*
         FROM leagues l
         JOIN wa_groups wg ON wg.league_id = l.id AND wg.is_active = true
         LEFT JOIN wa_league_settings wls ON wls.league_id = l.id
         WHERE l.id = $1`,
        [leagueId]
      );
      if (!leagueRes.rows[0]) {
        return res.status(404).json({ error: 'League group not found' });
      }
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
