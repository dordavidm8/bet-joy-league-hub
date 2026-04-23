'use strict';

const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { sendDM, callBot } = require('../services/whatsappBotService');

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function normalizePhone(raw) {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0972')) return digits.slice(1); // 0972... → 972...
  if (digits.startsWith('972')) return digits;           // +972 or 972...
  if (digits.startsWith('0')) return '972' + digits.slice(1); // 05x... → 9725x...
  return '972' + digits;
}

// GET /api/whatsapp/status
router.get('/status', authenticate, async (req, res, next) => {
  try {
    const r = await pool.query(
      `SELECT phone_number, phone_verified, wa_opt_in FROM users WHERE id = $1`,
      [req.user.id]
    );
    const u = r.rows[0];
    res.json({ phone_number: u.phone_number, phone_verified: u.phone_verified, wa_opt_in: u.wa_opt_in });
  } catch (err) { next(err); }
});

// POST /api/whatsapp/link-phone — send OTP
router.post('/link-phone', authenticate, async (req, res, next) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone required' });
  const normalized = normalizePhone(phone);

  try {
    // Check phone not already taken by another user
    const taken = await pool.query(
      `SELECT id FROM users WHERE phone_number = $1 AND id != $2`, [normalized, req.user.id]
    );
    if (taken.rows[0]) return res.status(409).json({ error: 'מספר זה כבר מקושר לחשבון אחר' });

    const code = generateOTP();
    const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await pool.query(
      `INSERT INTO wa_verification_codes (user_id, phone, code, expires_at) VALUES ($1,$2,$3,$4)`,
      [req.user.id, normalized, code, expires]
    );

    const sent = await sendDM(normalized,
      `👋 קוד האימות ל-KickOff: *${code}*\nקוד זה תקף ל-10 דקות.`
    );

    // In stub mode, return the code directly so dev can test
    const stubCode = process.env.STUB_MODE === 'true' ? code : undefined;
    res.json({ message: 'OTP נשלח', phone: normalized, ...(stubCode && { debug_code: stubCode }) });
  } catch (err) { next(err); }
});

// POST /api/whatsapp/verify
router.post('/verify', authenticate, async (req, res, next) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'code required' });

  try {
    const r = await pool.query(
      `SELECT * FROM wa_verification_codes
       WHERE user_id = $1 AND code = $2 AND used = false AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [req.user.id, code]
    );
    const record = r.rows[0];
    if (!record) return res.status(400).json({ error: 'קוד שגוי או פג תוקף' });

    await pool.query(`UPDATE wa_verification_codes SET used = true WHERE id = $1`, [record.id]);
    const userRes = await pool.query(
      `UPDATE users SET phone_number = $1, phone_verified = true WHERE id = $2 RETURNING username`,
      [record.phone, req.user.id]
    );
    const username = userRes.rows[0]?.username || 'שלך';

    // Upsert session
    await pool.query(
      `INSERT INTO wa_sessions (phone, user_id) VALUES ($1,$2)
       ON CONFLICT (phone) DO UPDATE SET user_id = $2, last_msg_at = NOW()`,
      [record.phone, req.user.id]
    );

    // Send the confirmation welcome message
    await sendDM(record.phone, `המשתמש ${username} חובר בהצלחה לטלפון זה!`);

    res.json({ message: 'מספר אומת בהצלחה', phone: record.phone });
  } catch (err) { next(err); }
});

// DELETE /api/whatsapp/unlink
router.delete('/unlink', authenticate, async (req, res, next) => {
  try {
    const r = await pool.query(`SELECT phone_number FROM users WHERE id = $1`, [req.user.id]);
    const phone = r.rows[0]?.phone_number;
    await pool.query(
      `UPDATE users SET phone_number = NULL, phone_verified = false WHERE id = $1`, [req.user.id]
    );
    if (phone) {
      await pool.query(`DELETE FROM wa_sessions WHERE phone = $1`, [phone]);
    }
    res.json({ message: 'מספר נותק' });
  } catch (err) { next(err); }
});

// PATCH /api/whatsapp/opt-in
router.patch('/opt-in', authenticate, async (req, res, next) => {
  const { wa_opt_in } = req.body;
  if (typeof wa_opt_in !== 'boolean') return res.status(400).json({ error: 'wa_opt_in must be boolean' });
  try {
    await pool.query(`UPDATE users SET wa_opt_in = $1 WHERE id = $2`, [wa_opt_in, req.user.id]);
    res.json({ wa_opt_in });
  } catch (err) { next(err); }
});

// POST /api/whatsapp/leagues/:id/create-group
router.post('/leagues/:id/create-group', authenticate, async (req, res, next) => {
  const { id: leagueId } = req.params;
  try {
    const leagueRes = await pool.query(`SELECT * FROM leagues WHERE id = $1`, [leagueId]);
    const league = leagueRes.rows[0];
    if (!league) return res.status(404).json({ error: 'League not found' });
    if (league.access_type === 'public') return res.status(403).json({ error: 'ליגות ציבוריות אינן יכולות להתחבר לקבוצת ווטסאפ' });
    if (league.creator_id !== req.user.id) return res.status(403).json({ error: 'Only creator can manage WA' });

    const membersRes = await pool.query(
      `SELECT u.phone_number FROM league_members lm
       JOIN users u ON u.id = lm.user_id
       WHERE lm.league_id = $1 AND u.phone_verified = true AND lm.is_active = true`,
      [leagueId]
    );

    if (membersRes.rows.length === 0) {
      return res.status(400).json({ error: 'אין משתתפים מאומתים בליגה ליצירת קבוצה' });
    }

    const participantPhones = membersRes.rows.map(r => r.phone_number);

    const result = await callBot('/internal/create-group', {
      name: `Kickoff - ${league.name} ⚽`,
      leagueName: league.name,
      phones: participantPhones,
      leagueId: leagueId,
      inviteCode: league.invite_code,
    });

    if (!result?.wa_group_id) {
      // Bot unavailable — queue and return pending status
      return res.json({ status: 'pending', message: 'הבוט אינו זמין כרגע. הקבוצה תיווצר כשיתחבר.' });
    }

    if (result.error) {
      return res.status(403).json({ error: result.error });
    }

    await pool.query(
      `INSERT INTO wa_groups (wa_group_id, league_id, invite_link)
       VALUES ($1,$2,$3) ON CONFLICT (wa_group_id) DO UPDATE SET 
         league_id=$2, 
         is_active=true, 
         invite_link = COALESCE(EXCLUDED.invite_link, wa_groups.invite_link)`,
      [result.wa_group_id, leagueId, result.invite_link || null]
    );
    await pool.query(
      `INSERT INTO wa_league_settings (league_id, bet_mode, stake_amount, exact_score_enabled, morning_message_time, leaderboard_frequency, leaderboard_time, leaderboard_day)
       VALUES ($1, 'prediction', 0, false, '09:00', 'weekly', '10:00', 0)
       ON CONFLICT (league_id) DO NOTHING`,
      [leagueId]
    );
    await pool.query(`UPDATE leagues SET wa_enabled = true WHERE id = $1`, [leagueId]);

    res.json({ wa_group_id: result.wa_group_id, invite_link: result.invite_link });
  } catch (err) { next(err); }
});

// POST /api/whatsapp/leagues/:id/link-group — link existing group by JID
router.post('/leagues/:id/link-group', authenticate, async (req, res, next) => {
  const { id: leagueId } = req.params;
  const { wa_group_id } = req.body;
  if (!wa_group_id) return res.status(400).json({ error: 'wa_group_id required' });

  try {
    const leagueRes = await pool.query(`SELECT * FROM leagues WHERE id = $1`, [leagueId]);
    const league = leagueRes.rows[0];
    if (!league) return res.status(404).json({ error: 'League not found' });
    if (league.access_type === 'public') return res.status(403).json({ error: 'ליגות ציבוריות אינן יכולות להתחבר לקבוצת ווטסאפ' });
    if (league.creator_id !== req.user.id) return res.status(403).json({ error: 'Only creator' });

    await pool.query(
      `INSERT INTO wa_groups (wa_group_id, league_id)
       VALUES ($1,$2) ON CONFLICT (wa_group_id) DO UPDATE SET 
         league_id=$2, 
         is_active=true`,
      [wa_group_id, leagueId]
    );
    await pool.query(
      `INSERT INTO wa_league_settings (league_id, bet_mode, stake_amount, exact_score_enabled, morning_message_time, leaderboard_frequency, leaderboard_time, leaderboard_day)
       VALUES ($1, 'prediction', 0, false, '09:00', 'weekly', '10:00', 0)
       ON CONFLICT (league_id) DO NOTHING`,
      [leagueId]
    );
    await pool.query(`UPDATE leagues SET wa_enabled = true WHERE id = $1`, [leagueId]);

    res.json({ message: 'קבוצה קושרה לליגה' });
  } catch (err) { next(err); }
});

// POST /api/whatsapp/leagues/:id/refresh-invite-link — try to get invite link from bot
router.post('/leagues/:id/refresh-invite-link', authenticate, async (req, res, next) => {
  const { id: leagueId } = req.params;
  try {
    const leagueRes = await pool.query(`SELECT creator_id, invite_code FROM leagues WHERE id = $1`, [leagueId]);
    if (!leagueRes.rows[0]) return res.status(404).json({ error: 'League not found' });
    if (leagueRes.rows[0].creator_id !== req.user.id) return res.status(403).json({ error: 'Only creator' });

    const groupRes = await pool.query(
      `SELECT wa_group_id FROM wa_groups WHERE league_id = $1 AND is_active = true LIMIT 1`, [leagueId]
    );
    if (!groupRes.rows[0]) return res.status(404).json({ error: 'No active WA group' });

    const result = await callBot('/internal/get-invite-link', {
      groupJid: groupRes.rows[0].wa_group_id,
      inviteCode: leagueRes.rows[0].invite_code
    });
    if (!result?.invite_link) return res.status(503).json({ error: 'הבוט לא הצליח לקבל לינק. הוסף את הבוט כמנהל בקבוצה ונסה שוב.' });

    await pool.query(
      `UPDATE wa_groups SET invite_link = $1 WHERE league_id = $2 AND is_active = true`,
      [result.invite_link, leagueId]
    );
    res.json({ invite_link: result.invite_link });
  } catch (err) { next(err); }
});

// PUT /api/whatsapp/leagues/:id/invite-link — manually set invite link
router.put('/leagues/:id/invite-link', authenticate, async (req, res, next) => {
  const { id: leagueId } = req.params;
  const { invite_link } = req.body;
  try {
    const leagueRes = await pool.query(`SELECT creator_id, name, invite_code FROM leagues WHERE id = $1`, [leagueId]);
    if (!leagueRes.rows[0]) return res.status(404).json({ error: 'League not found' });
    if (leagueRes.rows[0].creator_id !== req.user.id) return res.status(403).json({ error: 'Only creator' });

    if (invite_link) {
      const joinRes = await callBot('/internal/join-group-by-link', {
        link: invite_link,
        leagueId,
        leagueName: leagueRes.rows[0].name,
        inviteCode: leagueRes.rows[0].invite_code
      });

      if (joinRes?.error) {
        return res.status(403).json({ error: joinRes.error });
      }

      if (joinRes && joinRes.wa_group_id) {
        // Upsert group tracking
        await pool.query(
          `INSERT INTO wa_groups (wa_group_id, league_id, is_active, invite_link)
           VALUES ($1,$2,true,$3) 
           ON CONFLICT (wa_group_id) DO UPDATE SET 
             league_id=$2, 
             is_active=true, 
             invite_link=$3`,
          [joinRes.wa_group_id, leagueId, invite_link]
        );

        await pool.query(
          `INSERT INTO wa_league_settings (league_id, bet_mode, stake_amount, exact_score_enabled, morning_message_time, leaderboard_frequency, leaderboard_time, leaderboard_day)
           VALUES ($1, 'prediction', 0, false, '09:00', 'weekly', '10:00', 0)
           ON CONFLICT (league_id) DO NOTHING`,
          [leagueId]
        );
        await pool.query(`UPDATE leagues SET wa_enabled = true WHERE id = $1`, [leagueId]);
      } else {
        // fallback if bot is down or failed, just save the link
        await pool.query(
          `UPDATE wa_groups SET invite_link = $1 WHERE league_id = $2 AND is_active = true`,
          [invite_link, leagueId]
        );
      }
    } else {
      await pool.query(
        `UPDATE wa_groups SET invite_link = $1 WHERE league_id = $2 AND is_active = true`,
        [null, leagueId]
      );
    }

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// DELETE /api/whatsapp/leagues/:id/group
router.delete('/leagues/:id/group', authenticate, async (req, res, next) => {
  const { id: leagueId } = req.params;
  try {
    const leagueRes = await pool.query(`SELECT creator_id FROM leagues WHERE id = $1`, [leagueId]);
    if (!leagueRes.rows[0]) return res.status(404).json({ error: 'League not found' });
    if (leagueRes.rows[0].creator_id !== req.user.id) return res.status(403).json({ error: 'Only creator' });

    // Find the group we're disconnecting from
    const groupRes = await pool.query(
      `SELECT wa_group_id FROM wa_groups WHERE league_id = $1 AND is_active = true`, [leagueId]
    );

    await pool.query(`UPDATE wa_groups SET is_active = false WHERE league_id = $1`, [leagueId]);
    await pool.query(`UPDATE leagues SET wa_enabled = false WHERE id = $1`, [leagueId]);

    // Check if this group is still active in any OTHER league
    if (groupRes.rows.length > 0) {
      const waGroupId = groupRes.rows[0].wa_group_id;
      const otherRes = await pool.query(
        `SELECT id FROM wa_groups WHERE wa_group_id = $1 AND is_active = true LIMIT 1`, [waGroupId]
      );
      if (otherRes.rows.length === 0) {
        // Leave group
        setTimeout(() => {
          callBot('/internal/leave-group', { groupJid: waGroupId }).catch(e => console.error('[wa/leave] error:', e.message));
        }, 5000); // leave after 5 seconds
      }
    }

    res.json({ message: 'קבוצה נותקה' });
  } catch (err) { next(err); }
});

// GET /api/whatsapp/leagues/:id/settings
router.get('/leagues/:id/settings', authenticate, async (req, res, next) => {
  const { id: leagueId } = req.params;
  try {
    const r = await pool.query(
      `SELECT wls.*, wg.wa_group_id, wg.invite_link, wg.is_active AS group_active
       FROM leagues l
       LEFT JOIN wa_league_settings wls ON wls.league_id = l.id
       LEFT JOIN wa_groups wg ON wg.league_id = l.id AND wg.is_active = true
       WHERE l.id = $1`,
      [leagueId]
    );
    res.json({ settings: r.rows[0] || null });
  } catch (err) { next(err); }
});

// PUT /api/whatsapp/leagues/:id/settings
router.put('/leagues/:id/settings', authenticate, async (req, res, next) => {
  const { id: leagueId } = req.params;
  const {
    bet_mode, stake_amount, exact_score_enabled, morning_message_time,
    reminder_hours_before, leaderboard_frequency, leaderboard_time, leaderboard_day,
  } = req.body;

  try {
    const leagueRes = await pool.query(`SELECT creator_id FROM leagues WHERE id = $1`, [leagueId]);
    if (!leagueRes.rows[0]) return res.status(404).json({ error: 'League not found' });
    if (leagueRes.rows[0].creator_id !== req.user.id) return res.status(403).json({ error: 'Only creator' });

    await pool.query(
      `INSERT INTO wa_league_settings
         (league_id, bet_mode, stake_amount, exact_score_enabled, morning_message_time,
          reminder_hours_before, leaderboard_frequency, leaderboard_time, leaderboard_day)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (league_id) DO UPDATE SET
         bet_mode = EXCLUDED.bet_mode,
         stake_amount = EXCLUDED.stake_amount,
         exact_score_enabled = EXCLUDED.exact_score_enabled,
         morning_message_time = EXCLUDED.morning_message_time,
         reminder_hours_before = EXCLUDED.reminder_hours_before,
         leaderboard_frequency = EXCLUDED.leaderboard_frequency,
         leaderboard_time = EXCLUDED.leaderboard_time,
         leaderboard_day = EXCLUDED.leaderboard_day`,
      [leagueId, bet_mode || 'prediction', stake_amount || 0, exact_score_enabled || false,
        morning_message_time || '09:00', reminder_hours_before || null,
        leaderboard_frequency || 'weekly', leaderboard_time || '10:00', leaderboard_day ?? 0]
    );

    res.json({ message: 'הגדרות נשמרו' });
  } catch (err) { next(err); }
});

// POST /api/whatsapp/leagues/:id/broadcast — trigger manual broadcast for a league
router.post('/leagues/:id/broadcast', authenticate, async (req, res, next) => {
  const { id: leagueId } = req.params;
  try {
    const leagueRes = await pool.query(`SELECT creator_id FROM leagues WHERE id = $1`, [leagueId]);
    if (!leagueRes.rows[0]) return res.status(404).json({ error: 'League not found' });
    if (leagueRes.rows[0].creator_id !== req.user.id) return res.status(403).json({ error: 'Only creator can manual broadcast' });

    const result = await callBot('/internal/broadcast-league', { leagueId });
    if (!result?.ok) return res.status(503).json({ error: 'הבוט אינו זמין לשידור כרגע' });

    res.json({ message: 'השידור הופעל בהצלחה' });
  } catch (err) { next(err); }
});

module.exports = router;
