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
  // Consistency: exact score must match the selected winner
  if (scoreLine) {
    const [sh, sa] = scoreLine.split('-').map(Number);
    if (resultLine === '1' && sh <= sa) {
      await msg.reply(`❌ תוצאה לא מתאימה — אם בחרת קבוצה ביתית, הקבוצה הביתית חייבת לנצח (לדוגמה: 2-1)`);
      return;
    }
    if (resultLine === '2' && sa <= sh) {
      await msg.reply(`❌ תוצאה לא מתאימה — אם בחרת קבוצה אורחת, הקבוצה האורחת חייבת לנצח (לדוגמה: 1-2)`);
      return;
    }
    if (resultLine === 'X' && sh !== sa) {
      await msg.reply(`❌ תוצאה לא מתאימה — תיקו דורש מספרים שווים (לדוגמה: 1-1)`);
      return;
    }
  }

  const settings = await getLeagueSettings(gameMsgRecord.league_id);
  const gameRes = await pool.query(`SELECT * FROM games WHERE id = $1`, [gameMsgRecord.game_id]);
  const game = gameRes.rows[0];
  if (!game) { await msg.reply('❌ משחק לא נמצא'); return; }

  // Find the bet question for winner (type 'result' or 'winner')
  const questionRes = await pool.query(
    `SELECT * FROM bet_questions WHERE game_id = $1 AND type IN ('match_winner','result','winner','1x2') AND is_locked = false ORDER BY created_at LIMIT 1`,
    [game.id]
  );
  const question = questionRes.rows[0];
  if (!question) { await msg.reply('❌ הימור לא זמין למשחק זה כרגע'); return; }

  // outcomes order from buildBetQuestions: [home(0), draw(1), away(2)]
  const outcomeIndex = { '1': 0, 'X': 1, '2': 2 }[resultLine];
  const outcome = (question.outcomes || [])[outcomeIndex];
  // Use the actual label stored in the DB (may be Hebrew or English) so that
  // selected_outcome matches what resolveQuestion returns during settlement.
  const outcomeLabel = outcome?.label ?? { '1': game.home_team, 'X': 'תיקו', '2': game.away_team }[resultLine];

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

  const isUpdate = !!existing.rows[0];
  if (isUpdate) {
    const old = existing.rows[0];
    // Return old stake if fixed mode
    if (!old.is_free_bet && old.stake > 0) {
      await pool.query(`UPDATE users SET points_balance = points_balance + $1 WHERE id = $2`, [old.stake, user.id]);
    }
    await pool.query(`UPDATE bets SET status = 'cancelled' WHERE id = $1`, [old.id]);
  }

  // Deduct stake + increment total_bets
  if (!isFreeBet && stake > 0) {
    await pool.query(
      `UPDATE users SET points_balance = points_balance - $1, total_bets = total_bets + $2 WHERE id = $3 AND points_balance >= $1`,
      [stake, isUpdate ? 0 : 1, user.id]
    );
  } else if (!isUpdate) {
    await pool.query(`UPDATE users SET total_bets = total_bets + 1 WHERE id = $1`, [user.id]);
  }

  const wa_msg_id = msg.id._serialized;
  // Store exact_score_prediction on the main bet — settlement will apply ×3 if it matches
  const exactScorePrediction = (scoreLine && settings?.exact_score_enabled) ? scoreLine : null;

  await pool.query(
    `INSERT INTO bets
       (user_id, game_id, bet_question_id, selected_outcome, stake, odds,
        potential_payout, is_free_bet, wa_bet, wa_source, wa_bet_message_id, league_id, exact_score_prediction)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9,$10,$11,$12)`,
    [user.id, game.id, question.id, outcomeLabel, stake, outcome.odds,
     potentialPayout, isFreeBet, source, wa_msg_id, gameMsgRecord.league_id, exactScorePrediction]
  );

  await pool.query(
    `INSERT INTO wa_message_log (direction, phone, message, action) VALUES ('in',$1,$2,'bet_placed')`,
    [phone, content]
  );

  await msg.react('👍');
  if (exactScorePrediction) {
    await msg.reply(`🎯 תוצאה מדויקת נרשמה: ${exactScorePrediction} — תוצאה נכונה = תשלום מלא ×3 (זהות מנצחת + בונוס ×2 נוסף)`);
  }
}

module.exports = { getUserByPhone, processBetReply };
