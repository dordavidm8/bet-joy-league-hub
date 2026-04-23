/**
 * achievementService.js – מערכת הישגים ומדליות
 *
 * בודק ומעניק הישגים אוטומטית לאחר אירועי הימור:
 *   checkAndAward(userId, event) – בודק כל ההישגים הרלוונטיים ומעניק
 *
 * דוגמאות הישגים: FirstBet, FirstWin, Win10, Points1000, etc.
 * הישגים שנפתחו נשמרים ב-user_achievements table ונשלחת התראה.
 */
const { pool } = require('../config/database');

const ACHIEVEMENTS = {
  first_bet:       { title: 'הימור ראשון',  desc: 'ביצעת את ההימור הראשון שלך',        icon: '🎯' },
  first_win:       { title: 'ניצחון ראשון', desc: 'ניצחת בהימור לראשונה',               icon: '🏆' },
  streak_3:        { title: 'שלישייה',       desc: '3 ניצחונות ברצף',                    icon: '🔥' },
  streak_5:        { title: 'חמישייה',       desc: '5 ניצחונות ברצף',                    icon: '🔥🔥' },
  streak_10:       { title: 'עשיריית אש',    desc: '10 ניצחונות ברצף',                   icon: '⚡' },
  high_roller:     { title: 'שחקן גדול',     desc: 'הימרת 1,000+ נקודות בהימור בודד',   icon: '💎' },
  parlay_win:      { title: 'מלך הפרלאי',    desc: 'ניצחת בהימור פרלאי',                 icon: '👑' },
  league_champion: { title: 'אלוף הליגה',    desc: 'זכית במקום ראשון בליגה',             icon: '🥇' },
};

async function getStreak(userId) {
  const res = await pool.query(
    `SELECT status FROM bets
     WHERE user_id = $1 AND status IN ('won', 'lost') AND parlay_id IS NULL
     ORDER BY COALESCE(settled_at, placed_at) DESC
     LIMIT 15`,
    [userId]
  );
  let streak = 0;
  for (const row of res.rows) {
    if (row.status === 'won') streak++;
    else break;
  }
  return streak;
}

async function award(userId, key) {
  await pool.query(
    `INSERT INTO user_achievements (user_id, achievement_key) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, key]
  );
}

// context: 'bet_placed' | 'bet_won' | 'high_roller' | 'parlay_won' | 'league_champion'
async function checkAndAwardAchievements(userId, context) {
  if (process.env.STUB_MODE === 'true') return;
  try {
    if (context === 'bet_placed') {
      const { rows } = await pool.query(`SELECT total_bets FROM users WHERE id = $1`, [userId]);
      if (rows[0]?.total_bets === 1) await award(userId, 'first_bet');
    }

    if (context === 'high_roller') {
      await award(userId, 'high_roller');
    }

    if (context === 'bet_won') {
      const { rows } = await pool.query(`SELECT total_wins FROM users WHERE id = $1`, [userId]);
      if (rows[0]?.total_wins === 1) await award(userId, 'first_win');
      const streak = await getStreak(userId);
      if (streak >= 3)  await award(userId, 'streak_3');
      if (streak >= 5)  await award(userId, 'streak_5');
      if (streak >= 10) await award(userId, 'streak_10');
    }

    if (context === 'parlay_won') {
      await award(userId, 'parlay_win');
    }

    if (context === 'league_champion') {
      await award(userId, 'league_champion');
    }
  } catch (err) {
    console.error('[achievements] Error:', err.message);
  }
}

module.exports = { checkAndAwardAchievements, getStreak, ACHIEVEMENTS };
