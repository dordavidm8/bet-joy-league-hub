'use strict';

const pool = require('../utils/db');

async function getUserByPhone(phone) {
  const r = await pool.query(
    `SELECT id, username, points_balance FROM users WHERE phone_number = $1 AND phone_verified = true`,
    [phone]
  );
  return r.rows[0] || null;
}

async function getLeagueSettings(leagueId) {
  const r = await pool.query(
    `SELECT wls.*, l.name AS league_name
     FROM wa_league_settings wls JOIN leagues l ON l.id = wls.league_id
     WHERE wls.league_id = $1`,
    [leagueId]
  );
  return r.rows[0] || null;
}

async function processBetReply(client, msg, phone, user, gameMsgRecord, content, source) {
  const lines = content.trim().split('\n').map(l => l.trim().toUpperCase());
  const resultLine = lines[0];
  const scoreLine = lines[1] || null;

  if (!['1', 'X', '2'].includes(resultLine)) {
    await msg.reply('❌ פורמט לא תקין. שלח *1*, *X*, או *2*\n(ובשורה שנייה תוצאה מדויקת כמו 2-0)');
    return;
  }
  if (scoreLine && !/^\d+-\d+$/.test(scoreLine)) {
    await msg.reply('❌ פורמט תוצאה מדויקת לא תקין. דוגמה: *2-0*');
    return;
  }

  const settings = await getLeagueSettings(gameMsgRecord.league_id);
  const gameRes = await pool.query(`SELECT * FROM games WHERE id = $1`, [gameMsgRecord.game_id]);
  const game = gameRes.rows[0];
  if (!game) { await msg.reply('❌ משחק לא נמצא'); return; }

  // Find the bet question for winner (type 'result' or 'winner')
  const questionRes = await pool.query(
    `SELECT * FROM bet_questions WHERE game_id = $1 AND type IN ('result','winner','1x2') AND is_locked = false ORDER BY created_at LIMIT 1`,
    [game.id]
  );
  const question = questionRes.rows[0];
  if (!question) { await msg.reply('❌ הימור לא זמין למשחק זה כרגע'); return; }

  const outcomeMap = { '1': game.home_team, 'X': 'תיקו', '2': game.away_team };
  const outcomeLabel = outcomeMap[resultLine];
  const outcome = (question.outcomes || []).find(o =>
    o.label === outcomeLabel || o.label === resultLine
  ) || (question.outcomes || [])[0];

  if (!outcome) { await msg.reply('❌ אפשרות הימור לא נמצאה'); return; }

  const isFreeBet = settings?.bet_mode === 'prediction';
  const stake = isFreeBet ? 0 : (settings?.stake_amount || 0);

  // Check balance for fixed mode
  if (!isFreeBet && stake > 0 && user.points_balance < stake) {
    await msg.reply(`❌ אין מספיק נקודות (יתרה: ${user.points_balance}, נדרש: ${stake})`);
    return;
  }

  const potentialPayout = isFreeBet
    ? Math.round(outcome.odds)
    : Math.round(stake * outcome.odds);

  // Check for existing WA bet on this game/league
  const existing = await pool.query(
    `SELECT id, stake, is_free_bet FROM bets
     WHERE user_id = $1 AND game_id = $2 AND league_id = $3 AND wa_bet = true AND status != 'cancelled'`,
    [user.id, game.id, gameMsgRecord.league_id]
  );

  if (existing.rows[0]) {
    const old = existing.rows[0];
    // Return old stake if fixed mode
    if (!old.is_free_bet && old.stake > 0) {
      await pool.query(`UPDATE users SET points_balance = points_balance + $1 WHERE id = $2`, [old.stake, user.id]);
    }
    await pool.query(`UPDATE bets SET status = 'cancelled' WHERE id = $1`, [old.id]);
  }

  // Deduct stake
  if (!isFreeBet && stake > 0) {
    await pool.query(
      `UPDATE users SET points_balance = points_balance - $1 WHERE id = $2 AND points_balance >= $1`,
      [stake, user.id]
    );
  }

  const wa_msg_id = msg.id._serialized;
  await pool.query(
    `INSERT INTO bets
       (user_id, game_id, bet_question_id, selected_outcome, stake, odds,
        potential_payout, is_free_bet, wa_bet, wa_source, wa_bet_message_id, league_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9,$10,$11)`,
    [user.id, game.id, question.id, outcomeLabel, stake, outcome.odds,
     potentialPayout, isFreeBet, source, wa_msg_id, gameMsgRecord.league_id]
  );

  await pool.query(
    `INSERT INTO wa_message_log (direction, phone, message, action) VALUES ('in',$1,$2,'bet_placed')`,
    [phone, content]
  );

  await msg.react('👍');

  // Exact score bonus bet
  if (scoreLine && settings?.exact_score_enabled) {
    const exactOdds = outcome.odds * 3;
    const exactPayout = isFreeBet ? Math.round(exactOdds) : Math.round(stake * exactOdds);
    const exactQuestion = await pool.query(
      `SELECT id FROM bet_questions WHERE game_id = $1 AND type = 'exact_score' LIMIT 1`,
      [game.id]
    );
    if (exactQuestion.rows[0]) {
      await pool.query(
        `INSERT INTO bets
           (user_id, game_id, bet_question_id, selected_outcome, stake, odds,
            potential_payout, is_free_bet, wa_bet, wa_source, wa_bet_message_id, league_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9,$10,$11)`,
        [user.id, game.id, exactQuestion.rows[0].id, scoreLine, stake, exactOdds,
         exactPayout, isFreeBet, source, wa_msg_id, gameMsgRecord.league_id]
      );
    }
  }
}

module.exports = { getUserByPhone, processBetReply };
