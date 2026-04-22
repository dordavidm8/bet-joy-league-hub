'use strict';

const { pool } = require('../utils/db');
const { extractNumber } = require('../utils/phoneUtils');
const { handleSetupCommand } = require('../commands/groupCommands');

// ── Score parsing helper ─────────────────────────────────────────────────────
// Accepts: "2-0", "2 0", "2:0"
// Returns { home: number, away: number } or null if invalid
function parseScore(raw) {
  if (!raw) return null;
  const match = raw.trim().match(/^(\d+)[\s\-:](\d+)$/);
  if (!match) return null;
  return { home: parseInt(match[1], 10), away: parseInt(match[2], 10) };
}

// Validate & normalize exact score against the selected outcome.
// Rules:
//   - outcome = 'Draw'      → score must be tied (a === b)
//   - outcome = home team   → one of the two numbers must be greater than the other.
//                             We auto-orient so home > away regardless of input order.
//   - outcome = away team   → same auto-orient so away > home.
// Returns { normalized: "H-A" string } or { error: string }
function validateAndNormalizeScore(score, outcome, homeTeam, awayTeam) {
  const { home, away } = score;

  if (outcome === 'Draw') {
    if (home !== away) {
      return { error: `❌ הימרת על תיקו אבל שלחת תוצאה שאינה תיקו (${home}-${away}). דוגמה לתוצאה תקינה: 1-1` };
    }
    return { normalized: `${home}-${away}` };
  }

  // One team wins — scores must differ
  if (home === away) {
    const winner = outcome === homeTeam ? homeTeam : awayTeam;
    return { error: `❌ הימרת על ניצחון *${winner}* אבל שלחת תוצאת תיקו. דוגמה לתוצאה תקינה: 2-0` };
  }

  if (outcome === homeTeam) {
    // We want home > away regardless of which number the user wrote first
    const big = Math.max(home, away);
    const small = Math.min(home, away);
    return { normalized: `${big}-${small}` }; // home-away format, home wins
  }

  if (outcome === awayTeam) {
    const big = Math.max(home, away);
    const small = Math.min(home, away);
    return { normalized: `${small}-${big}` }; // home-away format, away wins
  }

  return { normalized: `${home}-${away}` };
}

// ── Parse incoming bet message ───────────────────────────────────────────────
// Returns { resultLine, scoreLine } or null if format is invalid in a way we
// want to silently ignore (not a bet attempt at all).
function parseBetMessage(body) {
  const lines = body.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return null;

  const firstLine = lines[0].toUpperCase();
  const parts = firstLine.split(/\s+/);
  const resultLine = parts[0];
  let scoreLine = lines[1] || parts[1] || null;

  // Validate resultLine early to avoid false positives for regular conversation
  if (!['1', 'X', '2', 'תיקו'].includes(resultLine)) return null;

  return { resultLine, scoreLine };
}

// ── Main group message handler ───────────────────────────────────────────────
async function handleGroupMessage(client, msg, chat) {
  const groupJid = chat.id._serialized;
  const body = (msg.body || '').toLowerCase();
  // Ignore help commands in groups explicitly
  if (body === 'עזרה' || body === '?' || body === '/help' || body === 'תפריט') return;

  // ── Command: Setup / Link League ───────────────────────────────────────────
  if (body.includes('/kickoff setup ')) {
    const inviteCode = body.split('/kickoff setup ')[1].split(' ')[0].trim();
    if (inviteCode) {
      await handleSetupCommand(client, msg, groupJid, inviteCode);
      return;
    }
  }

  // ── Command: שלח טבלה גבר ────────────────────────────────────────────────
  if (body === 'שלח טבלה גבר') {
    const groupRes = await pool.query(
      `SELECT g.league_id, g.is_active, l.name as league_name 
       FROM wa_groups g
       JOIN leagues l ON l.id = g.league_id
       WHERE g.wa_group_id = $1 AND g.is_active = true`,
      [groupJid]
    );
    
    if (groupRes.rows.length > 0) {
      const { sendLeaderboard } = require('../notifications/leaderboardNotifier');
      for (const groupFound of groupRes.rows) {
        await sendLeaderboard(client, {
          league_id: groupFound.league_id,
          league_name: groupFound.league_name,
          wa_group_id: groupJid
        }).catch(e => console.error('[command] leaderboard error:', e.message));
      }
      return;
    }
  }

  // ── Command: Bet Correction (Reply with "תיקון") ─────────────────────────
  if (body.startsWith('תיקון') && msg.hasQuotedMsg) {
    const quoted = await msg.getQuotedMessage();
    const quotedId = quoted.id._serialized;
    const contact = await msg.getContact();
    const senderPhone = contact.number;

    // 1. Resolve user
    const userRes = await pool.query(`SELECT id FROM users WHERE phone_number = $1`, [senderPhone]);
    if (!userRes.rows[0]) return;
    const user = userRes.rows[0];

    // 2. Find the bet associated with the quoted message
    // Users might reply to the BOT's confirmation message or their own original bet.
    const betRes = await pool.query(
      `SELECT b.*, g.status as game_status, g.home_team, g.away_team
       FROM bets b
       JOIN games g ON g.id = b.game_id
       WHERE b.user_id = $1 AND (b.wa_bet_message_id = $2 OR b.wa_confirmation_message_id = $2)
       AND b.status = 'pending'
       ORDER BY b.placed_at DESC LIMIT 1`,
      [user.id, quotedId]
    );

    const bet = betRes.rows[0];
    if (!bet) {
      await msg.reply('❌ לא מצאתי הימור ששייך לך על ההודעה הזו. וודא שאתה עושה Reply להודעת האישור של הבוט או להודעת ההימור המקורית שלך.');
      return;
    }

    if (bet.game_status !== 'scheduled') {
      await msg.reply('❌ לא ניתן לתקן הימור למשחק שכבר החל או הסתיים');
      return;
    }

    // 3. Parse the new bet from the correction message
    // Expected format:
    // תיקון
    // 1 2-1
    const lines = msg.body.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      await msg.reply('❌ פורמט תיקון לא תקין. יש לרשום "תיקון" ובשורה מתחת את ההימור החדש (מנצחת ותוצאה).\nלדוגמה:\nתיקון\n1 2-1');
      return;
    }

    const betDetail = lines[1]; // e.g. "1 2-1"
    const [resultPart, scorePart] = betDetail.split(/\s+/);
    
    if (!resultPart || !['1', 'x', '2', 'תיקו'].includes(resultPart.toLowerCase())) {
      await msg.reply('❌ המנצחת חייבת להיות 1 (בית), X (תיקו) או 2 (חוץ)');
      return;
    }

    const outcomeMap = { '1': bet.home_team, 'x': 'Draw', 'תיקו': 'Draw', '2': bet.away_team };
    const newOutcome = outcomeMap[resultPart.toLowerCase()];
    
    let newScore = null;
    if (scorePart) {
      const scoreObj = parseScore(scorePart);
      if (!scoreObj) {
        await msg.reply('❌ פורמט תוצאה לא תקין. דוגמה: 2-0');
        return;
      }
      const validation = validateAndNormalizeScore(scoreObj, newOutcome, bet.home_team, bet.away_team);
      if (validation.error) {
        await msg.reply(validation.error);
        return;
      }
      newScore = validation.normalized;
    } else {
      await msg.reply('❌ חסרה תוצאה מדויקת להימור. דוגמה: 2-1');
      return;
    }

    // 4. Update the bet
    await pool.query(
      `UPDATE bets SET selected_outcome = $1, exact_score_prediction = $2, updated_at = NOW() WHERE id = $3`,
      [newOutcome, newScore, bet.id]
    );

    await msg.react('👍');
    return;
  }

  // Check if this is a registered Kickoff group for other features (betting)
  const groupRes = await pool.query(
    `SELECT league_id FROM wa_groups WHERE wa_group_id = $1 AND is_active = true`,
    [groupJid]
  );
  if (!groupRes.rows[0]) return;

  // Only handle replies for betting — ignore all other group messages silently
  if (!msg.hasQuotedMsg) return;

  console.log(`[WA-DEBUG] Processing message from ${msg.author || msg.from} | body: ${body}`);
  const contact = await msg.getContact();
  const senderPhone = contact.number;
  const quoted = await msg.getQuotedMessage();
  if (!quoted) return;
  
  const quotedId = quoted.id._serialized;
  console.log(`[WA-DEBUG] Quoted message ID: ${quotedId} | SenderPhone: ${senderPhone}`);

  // Check if reply is to one of our game messages
  const gameMsgRes = await pool.query(
    `SELECT * FROM wa_game_messages WHERE wa_message_id = $1`,
    [quotedId]
  );

  if (gameMsgRes.rows[0]) {
    await processBetReply(client, msg, senderPhone, gameMsgRes.rows[0], 'group');
    return;
  }

  // Check if reply is to user's own bet message (correction)
  const userRes = await pool.query(`SELECT id FROM users WHERE phone_number = $1`, [senderPhone]);
  if (!userRes.rows[0]) return;
  const user = userRes.rows[0];

  const betRes = await pool.query(
    `SELECT b.*, g.status as game_status, g.home_team, g.away_team
     FROM bets b
     JOIN games g ON g.id = b.game_id
     WHERE b.user_id = $1 
     AND (b.wa_bet_message_id = $2 OR b.wa_confirmation_message_id = $2)
     AND b.status = 'pending'
     ORDER BY b.placed_at DESC LIMIT 1`,
    [user.id, quotedId]
  );

  if (betRes.rows[0]) {
    await processBetCorrection(client, msg, senderPhone, betRes.rows[0]);
  }
  // If none of the above matched — silently ignore (it's just a regular reply in the group)
}

// ── Process a new bet ────────────────────────────────────────────────────────
async function processBetReply(client, msg, senderPhone, gameMsg, source) {
  // Lookup user by phone — silent ignore if not linked
  const userRes = await pool.query(
    `SELECT * FROM users WHERE phone_number = $1 AND phone_verified = true`,
    [senderPhone]
  );
  if (!userRes.rows[0]) return;

  const user = userRes.rows[0];
  const parsed = parseBetMessage(msg.body);
  if (!parsed) return;

  const { resultLine, scoreLine: rawScore } = parsed;

  // Validate result line
  if (!['1', 'X', '2', 'תיקו'].includes(resultLine)) {
    // Silently ignore — probably just a regular reply unrelated to betting
    return;
  }

  // Get game + league settings
  const gameRes = await pool.query(
    `SELECT g.*, wls.bet_mode, wls.stake_amount, wls.exact_score_enabled
     FROM games g
     JOIN wa_game_messages wgm ON wgm.game_id = g.id AND wgm.wa_message_id = $1
     JOIN wa_league_settings wls ON wls.league_id = wgm.league_id
     WHERE g.status = 'scheduled'`,
    [gameMsg.wa_message_id]
  );
  console.log(`[WA-DEBUG] Game look-up result: ${gameRes.rows.length} rows found for msgId ${gameMsg.wa_message_id}`);
  
  if (!gameRes.rows[0]) {
    await msg.reply('❌ המשחק הזה כבר לא פתוח להימורים');
    return;
  }
  const game = gameRes.rows[0];
  console.log(`[WA-DEBUG] Processing bet for Game: ${game.home_team} vs ${game.away_team} (ID: ${game.id})`);

  // Map 1/X/2/תיקו to outcome
  const outcomeMap = { '1': game.home_team, 'X': 'Draw', 'תיקו': 'Draw', '2': game.away_team };
  const selectedOutcome = outcomeMap[resultLine] || 'Draw';

  // Parse & validate exact score if provided
  let normalizedScore = null;
  if (rawScore) {
    const scoreObj = parseScore(rawScore);
    if (!scoreObj) {
      await msg.reply('❌ פורמט תוצאה מדויקת לא תקין. דוגמאות: 2-0 | 2 0 | 2:0');
      return;
    }
    const validation = validateAndNormalizeScore(scoreObj, selectedOutcome, game.home_team, game.away_team);
    if (validation.error) {
      await msg.reply(validation.error);
      return;
    }
    normalizedScore = validation.normalized;
  }

  // ── 1. Find the specific bet question (the bot only handles match_winner) ─────
  const questionRes = await pool.query(
    `SELECT * FROM bet_questions WHERE game_id = $1 AND type = 'match_winner' LIMIT 1`,
    [game.id]
  );
  if (!questionRes.rows[0]) {
    await msg.reply('❌ לא נמצאו שאלות הימור למשחק זה');
    return;
  }
  const question = questionRes.rows[0];

  // ── 2. Check for existing bet on THIS QUESTION in THIS LEAGUE ───────────────
  const existingRes = await pool.query(
    `SELECT * FROM bets 
     WHERE user_id = $1 AND bet_question_id = $2 AND league_id = $3 AND status = 'pending'`,
    [user.id, question.id, gameMsg.league_id]
  );

  let isUpdate = false;
  if (existingRes.rows[0]) {
    const prevBet = existingRes.rows[0];
    isUpdate = true;
    // Refund stake if the old bet had one
    if (!prevBet.is_free_bet && prevBet.stake > 0) {
      await pool.query(`UPDATE users SET points_balance = points_balance + $1 WHERE id = $2`, [prevBet.stake, user.id]);
    }
    // Delete the old bet to make room for the new one (avoids unique constraint if any)
    await pool.query(`DELETE FROM bets WHERE id = $1`, [prevBet.id]);
  }

  // ── 3. Odds and Calculations ────────────────────────────────────────────────
  const outcomes = question.outcomes || [];
  let odds = 2.0;
  if (selectedOutcome === 'Draw') {
    odds = outcomes[1]?.odds || 2.0;
  } else if (selectedOutcome === game.home_team) {
    odds = outcomes[0]?.odds || 2.0;
  } else if (selectedOutcome === game.away_team) {
    odds = outcomes[2]?.odds || 2.0;
  }

  const isFree = game.bet_mode === 'prediction';
  const stake = isFree ? 0 : (game.stake_amount || 0);

  // Check balance if needed
  if (!isFree && stake > 0) {
    const balRes = await pool.query(`SELECT points_balance FROM users WHERE id = $1`, [user.id]);
    if (balRes.rows[0].points_balance < stake) {
      await msg.reply(`❌ אין לך מספיק נקודות. יתרה: ${balRes.rows[0].points_balance} | נדרש: ${stake}`);
      return;
    }
    await pool.query(`UPDATE users SET points_balance = points_balance - $1 WHERE id = $2`, [stake, user.id]);
  }

  const potentialPayout = (isFree ? 1 : stake) * odds;

  // ── 4. Insert New Bet ───────────────────────────────────────────────────────
  await pool.query(
    `INSERT INTO bets (user_id, bet_question_id, game_id, league_id, selected_outcome, odds, stake, potential_payout, is_free_bet, wa_bet, wa_source, wa_bet_message_id, exact_score_prediction)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,$10,$11,$12)`,
    [user.id, question.id, game.id, gameMsg.league_id, selectedOutcome, odds, stake, potentialPayout, isFree, source, msg.id._serialized, normalizedScore]
  );

  // ── 5. Confirmation ────────────────────────────────────────────────────────
  try { 
    await msg.react('👍'); 
    if (isUpdate) {
      // Small confirmation for update
      await msg.reply(`🔄 ההימור שלך על *${game.home_team} - ${game.away_team}* עודכן בהצלחה!`);
    }
  } catch {}
}

// ── Process a bet correction (reply to own bet message) ──────────────────────
async function processBetCorrection(client, msg, senderPhone, prevBet) {
  const parsed = parseBetMessage(msg.body);
  if (!parsed) return;

  const { resultLine } = parsed;
  if (!['1', 'X', '2', 'תיקו'].includes(resultLine)) return; // silent ignore

  // Refund stake on old match_winner bet
  if (!prevBet.is_free_bet && prevBet.stake > 0) {
    await pool.query(
      `UPDATE users SET points_balance = points_balance + $1 WHERE id = $2`,
      [prevBet.stake, prevBet.user_id]
    );
  }

  // Delete ALL pending bets for this game from this user (match_winner + exact_score)
  await pool.query(
    `DELETE FROM bets
     WHERE user_id = $1 AND game_id = $2 AND wa_bet = true AND status IN ('pending', 'cancelled')`,
    [prevBet.user_id, prevBet.game_id]
  );

  // Re-run the normal bet flow using the original game message
  const gameMsgRes = await pool.query(
    `SELECT * FROM wa_game_messages WHERE game_id = $1 AND league_id = $2 LIMIT 1`,
    [prevBet.game_id, prevBet.league_id]
  );
  if (!gameMsgRes.rows[0]) return;

  // Rebuild a minimal msg-like object so processBetReply works correctly
  const fakeMsg = {
    body: msg.body,
    id: msg.id,
    from: msg.from,
    hasQuotedMsg: false,
    reply: msg.reply.bind(msg),
    react: msg.react.bind(msg),
  };

  await processBetReply(client, fakeMsg, senderPhone, gameMsgRes.rows[0], prevBet.wa_source || 'group');
}

module.exports = { handleGroupMessage, processBetReply };
