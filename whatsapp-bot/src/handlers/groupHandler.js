'use strict';

const { pool } = require('../utils/db');
const { extractNumber } = require('../utils/phoneUtils');

async function handleGroupMessage(client, msg, chat) {
  const groupJid = chat.id._serialized;

  // Only handle replies
  if (!msg.hasQuotedMsg) return;

  // Check if this is a registered Kickoff group
  const groupRes = await pool.query(
    `SELECT league_id FROM wa_groups WHERE wa_group_id = $1 AND is_active = true`,
    [groupJid]
  );
  if (!groupRes.rows[0]) return;

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
     WHERE b.wa_bet_message_id = $1 AND u.phone_number = $2`,
    [quotedId, senderPhone]
  );

  if (prevBetRes.rows[0]) {
    await processBetCorrection(client, msg, senderPhone, prevBetRes.rows[0]);
  }
}

async function processBetReply(client, msg, senderPhone, gameMsg, source) {
  // Lookup user by phone
  const userRes = await pool.query(
    `SELECT * FROM users WHERE phone_number = $1 AND phone_verified = true`,
    [senderPhone]
  );
  if (!userRes.rows[0]) return; // No account linked — silently ignore in group

  const user = userRes.rows[0];
  const content = msg.body.trim();
  const lines = content.split('\n').map(l => l.trim());
  const resultLine = lines[0].toUpperCase();
  const scoreLine = lines[1] || null;

  if (!['1', 'X', '2'].includes(resultLine)) {
    await msg.reply('❌ פורמט לא תקין. שלח *1*, *X*, או *2* (ובשורה שנייה תוצאה מדויקת כמו 2-0)');
    return;
  }

  if (scoreLine && !/^\d+-\d+$/.test(scoreLine)) {
    await msg.reply('❌ פורמט תוצאה מדויקת לא תקין. דוגמה: 2-0');
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

  // Check for existing bet on this game
  const existingRes = await pool.query(
    `SELECT b.* FROM bets b
     JOIN bet_questions bq ON bq.id = b.bet_question_id
     WHERE b.user_id = $1 AND bq.game_id = $2 AND b.wa_bet = true AND b.status = 'pending'`,
    [user.id, game.id]
  );

  if (existingRes.rows[0]) {
    await msg.reply('⚠️ כבר הימרת על משחק זה. כדי לתקן, השב להודעת ההימור שלך עם ההימור החדש');
    return;
  }

  // Get the match_winner bet_question for this game
  const questionRes = await pool.query(
    `SELECT * FROM bet_questions WHERE game_id = $1 AND type = 'match_winner' LIMIT 1`,
    [game.id]
  );
  if (!questionRes.rows[0]) {
    await msg.reply('❌ לא נמצאו שאלות הימור לשחק זה');
    return;
  }
  const question = questionRes.rows[0];

  // Map 1/X/2 to outcome
  const outcomeMap = { '1': game.home_team, 'X': 'Draw', '2': game.away_team };
  const selectedOutcome = outcomeMap[resultLine];

  // Get odds for selected outcome
  const oddsRes = await pool.query(
    `SELECT odds FROM bet_options WHERE bet_question_id = $1 AND outcome = $2`,
    [question.id, selectedOutcome]
  );
  const odds = oddsRes.rows[0]?.odds || 2.0;

  // Create bet
  const isFree = game.bet_mode === 'prediction';
  const stake = isFree ? 0 : (game.stake_amount || 0);

  if (!isFree && stake > 0) {
    // Check balance
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
  const betRes = await pool.query(
    `INSERT INTO bets (user_id, bet_question_id, game_id, league_id, selected_outcome, odds, stake, potential_payout, is_free_bet, wa_bet, wa_source, wa_bet_message_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,$10,$11) RETURNING id`,
    [user.id, question.id, game.id, gameMsg.league_id, selectedOutcome, odds, stake, payout, isFree, source, msg.id._serialized]
  );

  // Exact score bet (second row)
  if (scoreLine && game.exact_score_enabled) {
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
        [user.id, exactQuestion.rows[0].id, game.id, gameMsg.league_id, scoreLine, exactOdds, stake, exactPayout, isFree, source, msg.id._serialized]
      );
    }
  }

  // React 👍
  try { await msg.react('👍'); } catch {}

  const scoreInfo = scoreLine ? ` + תוצאה ${scoreLine}` : '';
  await msg.reply(`✅ הימור נשמר: *${resultLine}*${scoreInfo} | רווח פוטנציאלי: ${payout} נקודות`);
}

async function processBetCorrection(client, msg, senderPhone, prevBet) {
  const content = msg.body.trim();
  const lines = content.split('\n').map(l => l.trim());
  const resultLine = lines[0].toUpperCase();
  const scoreLine = lines[1] || null;

  if (!['1', 'X', '2'].includes(resultLine)) {
    await msg.reply('❌ פורמט לא תקין. שלח 1, X, או 2');
    return;
  }

  // Refund old stake if fixed mode
  if (!prevBet.is_free_bet && prevBet.stake > 0) {
    await pool.query(
      `UPDATE users SET points_balance = points_balance + $1 WHERE id = $2`,
      [prevBet.stake, prevBet.user_id]
    );
  }

  // Cancel old bet
  await pool.query(`UPDATE bets SET status = 'cancelled' WHERE id = $1`, [prevBet.id]);

  // Re-run the normal bet flow using the original game message
  const gameMsgRes = await pool.query(
    `SELECT * FROM wa_game_messages WHERE game_id = $1 AND league_id = $2 LIMIT 1`,
    [prevBet.game_id, prevBet.league_id]
  );
  if (!gameMsgRes.rows[0]) return;

  // Temporarily override msg.body for reuse
  const fakeMsg = Object.assign(Object.create(Object.getPrototypeOf(msg)), msg, {
    body: content,
    id: msg.id,
    reply: msg.reply.bind(msg),
    react: msg.react.bind(msg),
  });

  await processBetReply(client, fakeMsg, senderPhone, gameMsgRes.rows[0], prevBet.wa_source || 'group');
}

module.exports = { handleGroupMessage };
