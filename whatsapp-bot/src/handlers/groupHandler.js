'use strict';

const { pool } = require('../utils/db');
const { extractNumber } = require('../utils/phoneUtils');

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
  const resultLine = lines[0].toUpperCase();
  const scoreLine = lines[1] || null;
  return { resultLine, scoreLine };
}

// ── Main group message handler ───────────────────────────────────────────────
async function handleGroupMessage(client, msg, chat) {
  const groupJid = chat.id._serialized;

  // Check if this is a registered Kickoff group
  const groupRes = await pool.query(
    `SELECT league_id FROM wa_groups WHERE wa_group_id = $1 AND is_active = true`,
    [groupJid]
  );
  if (!groupRes.rows[0]) return;

  // Log incoming message for debugging
  await pool.query(
    `INSERT INTO wa_message_log (direction, phone, group_jid, message, action)
     VALUES ('in', $1, $2, $3, 'group_message')`,
    [extractNumber(msg.from), groupJid, msg.body]
  ).catch(() => {});

  // ── Command: @kickoff טבלה ────────────────────────────────────────────────
  const body = (msg.body || '').toLowerCase();
  const botNumber = client.info?.wid?.user;
  
  const isBotMentioned = msg.mentionedIds?.some(id => id === client.info.wid._serialized) || 
                         body.includes('@kickoff') ||
                         (botNumber && body.includes(`@${botNumber}`));

  if (isBotMentioned && body.includes('טבלה')) {
    const { sendLeaderboard } = require('../notifications/leaderboardNotifier');
    await sendLeaderboard(client, {
      league_id: groupRes.rows[0].league_id,
      league_name: chat.name,
      wa_group_id: groupJid
    }).catch(e => console.error('[command] leaderboard error:', e.message));
    return;
  }

  // Only handle replies for betting — ignore all other group messages silently
  if (!msg.hasQuotedMsg) return;

  const quoted = await msg.getQuotedMessage();
  const quotedId = quoted.id._serialized;
  const senderPhone = extractNumber(msg.from);

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
  const prevBetRes = await pool.query(
    `SELECT b.*, u.id AS user_id_val FROM bets b
     JOIN users u ON u.id = b.user_id
     WHERE b.wa_bet_message_id = $1 AND u.phone_number = $2
       AND b.status = 'pending'
     ORDER BY b.placed_at DESC
     LIMIT 1`,
    [quotedId, senderPhone]
  );

  if (prevBetRes.rows[0]) {
    await processBetCorrection(client, msg, senderPhone, prevBetRes.rows[0]);
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
  if (!['1', 'X', '2'].includes(resultLine)) {
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
  if (!gameRes.rows[0]) {
    await msg.reply('❌ המשחק הזה כבר לא פתוח להימורים');
    return;
  }
  const game = gameRes.rows[0];

  // Map 1/X/2 to outcome
  const outcomeMap = { '1': game.home_team, 'X': 'Draw', '2': game.away_team };
  const selectedOutcome = outcomeMap[resultLine];

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

  // Check for existing pending bet on this game
  const existingRes = await pool.query(
    `SELECT b.* FROM bets b
     JOIN bet_questions bq ON bq.id = b.bet_question_id
     WHERE b.user_id = $1 AND bq.game_id = $2 AND b.wa_bet = true AND b.status = 'pending'`,
    [user.id, game.id]
  );

  if (existingRes.rows[0]) {
    await msg.reply('⚠️ כבר הימרת על משחק זה. כדי לתקן, *השב להודעת ההימור שלך* עם ההימור המעודכן');
    return;
  }

  // Get the match_winner bet_question for this game
  const questionRes = await pool.query(
    `SELECT * FROM bet_questions WHERE game_id = $1 AND type = 'match_winner' LIMIT 1`,
    [game.id]
  );
  if (!questionRes.rows[0]) {
    await msg.reply('❌ לא נמצאו שאלות הימור למשחק זה');
    return;
  }
  const question = questionRes.rows[0];

  // Get odds
  const oddsRes = await pool.query(
    `SELECT odds FROM bet_options WHERE bet_question_id = $1 AND outcome = $2`,
    [question.id, selectedOutcome]
  );
  const odds = oddsRes.rows[0]?.odds || 2.0;

  // Handle stake / balance
  const isFree = game.bet_mode === 'prediction';
  const stake = isFree ? 0 : (game.stake_amount || 0);

  if (!isFree && stake > 0) {
    const balRes = await pool.query(`SELECT points_balance FROM users WHERE id = $1`, [user.id]);
    if (balRes.rows[0].points_balance < stake) {
      await msg.reply(`❌ אין לך מספיק נקודות. יתרה: ${balRes.rows[0].points_balance} | נדרש: ${stake}`);
      return;
    }
    await pool.query(
      `UPDATE users SET points_balance = points_balance - $1 WHERE id = $2`,
      [stake, user.id]
    );
  }

  const payout = Math.round((isFree ? 1 : stake) * odds);

  // Save match_winner bet
  await pool.query(
    `INSERT INTO bets (user_id, bet_question_id, game_id, league_id, selected_outcome, odds, stake, potential_payout, is_free_bet, wa_bet, wa_source, wa_bet_message_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,$10,$11)`,
    [user.id, question.id, game.id, gameMsg.league_id, selectedOutcome, odds, stake, payout, isFree, source, msg.id._serialized]
  );

  // Save exact_score bet if provided and enabled
  if (normalizedScore && game.exact_score_enabled) {
    const exactQuestion = await pool.query(
      `SELECT id FROM bet_questions WHERE game_id = $1 AND type = 'exact_score' LIMIT 1`,
      [game.id]
    );
    if (exactQuestion.rows[0]) {
      const exactOdds = odds * 3;
      const exactPayout = Math.round((isFree ? 1 : stake) * exactOdds);
      await pool.query(
        `INSERT INTO bets (user_id, bet_question_id, game_id, league_id, selected_outcome, odds, stake, potential_payout, is_free_bet, wa_bet, wa_source, wa_bet_message_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,$10,$11)`,
        [user.id, exactQuestion.rows[0].id, game.id, gameMsg.league_id, normalizedScore, exactOdds, stake, exactPayout, isFree, source, msg.id._serialized]
      );
    }
  }

  // React 👍 and confirm
  try { await msg.react('👍'); } catch {}

  const outcomeLabel = resultLine === 'X' ? 'תיקו' : resultLine === '1' ? game.home_team : game.away_team;
  const scoreInfo = normalizedScore ? ` | תוצאה מדויקת: *${normalizedScore}*` : '';
  await msg.reply(`✅ הימור נשמר!\n*${outcomeLabel}*${scoreInfo}\nרווח פוטנציאלי: *${payout} נקודות*`);
}

// ── Process a bet correction (reply to own bet message) ──────────────────────
async function processBetCorrection(client, msg, senderPhone, prevBet) {
  const parsed = parseBetMessage(msg.body);
  if (!parsed) return;

  const { resultLine } = parsed;
  if (!['1', 'X', '2'].includes(resultLine)) return; // silent ignore

  // Refund stake on old match_winner bet
  if (!prevBet.is_free_bet && prevBet.stake > 0) {
    await pool.query(
      `UPDATE users SET points_balance = points_balance + $1 WHERE id = $2`,
      [prevBet.stake, prevBet.user_id]
    );
  }

  // Cancel ALL pending bets for this game from this user (match_winner + exact_score)
  await pool.query(
    `UPDATE bets SET status = 'cancelled'
     WHERE user_id = $1 AND game_id = $2 AND wa_bet = true AND status = 'pending'`,
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
