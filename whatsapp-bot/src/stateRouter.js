'use strict';

const pool = require('./utils/db');

async function getSession(phone) {
  const r = await pool.query(
    `SELECT * FROM wa_sessions WHERE phone = $1`, [phone]
  );
  if (!r.rows[0]) return { state: 'idle', context: {} };
  // Timeout: >30 min idle → reset
  const lastMsg = new Date(r.rows[0].last_msg_at);
  if (Date.now() - lastMsg.getTime() > 30 * 60 * 1000) {
    await pool.query(`UPDATE wa_sessions SET state='idle', context='{}' WHERE phone=$1`, [phone]);
    return { state: 'idle', context: {} };
  }
  return r.rows[0];
}

async function updateSession(phone, state, context) {
  await pool.query(
    `INSERT INTO wa_sessions (phone, state, context, last_msg_at)
     VALUES ($1,$2,$3,NOW())
     ON CONFLICT (phone) DO UPDATE SET state=$2, context=$3, last_msg_at=NOW()`,
    [phone, state, JSON.stringify(context)]
  );
}

async function route(client, msg, phone, user, content) {
  const session = await getSession(phone);
  const { state, context } = session;
  const lower = content.toLowerCase();

  if (state === 'idle') {
    if (['/bet', 'הימור', 'bet'].includes(lower)) {
      // Show upcoming games
      const games = await pool.query(
        `SELECT id, home_team, away_team, start_time FROM games
         WHERE status = 'scheduled' AND start_time > NOW() + INTERVAL '1 hour'
         ORDER BY start_time ASC LIMIT 5`
      );
      if (!games.rows.length) {
        await msg.reply('אין משחקים פתוחים להימור כרגע.');
        return;
      }
      let text = '⚽ *בחר משחק להימור:*\n';
      games.rows.forEach((g, i) => {
        const t = new Date(g.start_time).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
        text += `${i + 1}. ${g.home_team} נגד ${g.away_team} | ${t}\n`;
      });
      text += '\nשלח מספר (1-5) או *ביטול*';
      await msg.reply(text);
      await updateSession(phone, 'selecting_game', { games: games.rows.map(g => ({ id: g.id, home: g.home_team, away: g.away_team })) });
    } else {
      await msg.reply('שלח */help* לרשימת פקודות.');
    }
    return;
  }

  if (state === 'selecting_game') {
    const idx = parseInt(content) - 1;
    const gameList = context.games || [];
    if (isNaN(idx) || idx < 0 || idx >= gameList.length) {
      await msg.reply('❌ מספר לא תקין. שלח מספר בין 1 ל-' + gameList.length + ' או *ביטול*');
      return;
    }
    const game = gameList[idx];
    const questions = await pool.query(
      `SELECT id, question_text, outcomes FROM bet_questions WHERE game_id = $1 AND is_locked = false`, [game.id]
    );
    if (!questions.rows.length) { await msg.reply('❌ אין שאלות הימור למשחק זה.'); await updateSession(phone, 'idle', {}); return; }

    let text = `*${game.home} נגד ${game.away}*\n\nבחר שאלת הימור:\n`;
    questions.rows.forEach((q, i) => { text += `${i + 1}. ${q.question_text}\n`; });
    text += '\nשלח מספר או *ביטול*';
    await msg.reply(text);
    await updateSession(phone, 'selecting_outcome', { game, questions: questions.rows });
    return;
  }

  if (state === 'selecting_outcome') {
    const idx = parseInt(content) - 1;
    const qs = context.questions || [];
    if (isNaN(idx) || idx < 0 || idx >= qs.length) {
      await msg.reply('❌ מספר לא תקין. שלח מספר בין 1 ל-' + qs.length + ' או *ביטול*');
      return;
    }
    const question = qs[idx];
    const outcomes = question.outcomes || [];
    let text = `*${question.question_text}*\n\nבחר תוצאה:\n`;
    outcomes.forEach((o, i) => { text += `${i + 1}. ${o.label} (x${o.odds})\n`; });
    text += '\nשלח מספר או *ביטול*';
    await msg.reply(text);
    await updateSession(phone, 'entering_stake', { ...context, question, outcomes });
    return;
  }

  if (state === 'entering_stake') {
    const idx = parseInt(content) - 1;
    const outcomes = context.outcomes || [];
    if (isNaN(idx) || idx < 0 || idx >= outcomes.length) {
      await msg.reply('❌ מספר לא תקין. שלח מספר בין 1 ל-' + outcomes.length + ' או *ביטול*');
      return;
    }
    const chosen = outcomes[idx];
    let text = `*${chosen.label}* (x${chosen.odds})\n\nכמה נקודות תרצה להמר?\n`;
    text += `(יתרה: ${user.points_balance.toLocaleString()} נק׳)\nשלח מספר או *ביטול*`;
    await msg.reply(text);
    await updateSession(phone, 'confirming_bet', { ...context, chosen });
    return;
  }

  if (state === 'confirming_bet') {
    const stakeNum = parseInt(content);
    if (isNaN(stakeNum) || stakeNum <= 0) {
      await msg.reply('❌ סכום לא תקין. שלח מספר חיובי או *ביטול*');
      return;
    }
    if (stakeNum > user.points_balance) {
      await msg.reply(`❌ אין מספיק נקודות (יתרה: ${user.points_balance.toLocaleString()})`);
      return;
    }

    const { game, question, chosen } = context;
    const payout = Math.round(stakeNum * chosen.odds);
    let text = `*אישור הימור:*\n\n${game.home} נגד ${game.away}\n${question.question_text}\nבחרת: *${chosen.label}* (x${chosen.odds})\nסכום: *${stakeNum.toLocaleString()}* נק׳\nרווח פוטנציאלי: *${payout.toLocaleString()}* נק׳\n\nשלח *כן* לאישור או *ביטול*`;
    await msg.reply(text);
    await updateSession(phone, 'final_confirm', { ...context, stake: stakeNum, payout });
    return;
  }

  if (state === 'final_confirm') {
    if (!['כן', 'yes', 'אשר', 'confirm'].includes(lower)) {
      await msg.reply('✅ ההימור בוטל.');
      await updateSession(phone, 'idle', {});
      return;
    }

    const { game, question, chosen, stake } = context;
    if (stake > user.points_balance) {
      await msg.reply('❌ אין מספיק נקודות. ההימור בוטל.');
      await updateSession(phone, 'idle', {});
      return;
    }

    await pool.query(
      `UPDATE users SET points_balance = points_balance - $1 WHERE id = $2`, [stake, user.id]
    );
    const payout = Math.round(stake * chosen.odds);
    await pool.query(
      `INSERT INTO bets (user_id, game_id, bet_question_id, selected_outcome, stake, odds, potential_payout, wa_bet, wa_source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,true,'dm')`,
      [user.id, game.id, question.id, chosen.label, stake, chosen.odds, payout]
    );

    await msg.reply(`✅ הימור אושר!\n${chosen.label} · ${stake.toLocaleString()} נק׳ · רווח פוטנציאלי: ${payout.toLocaleString()} נק׳`);
    await updateSession(phone, 'idle', {});
    return;
  }

  // Fallback
  await msg.reply('שלח */help* לרשימת פקודות.');
  await updateSession(phone, 'idle', {});
}

module.exports = { route };
