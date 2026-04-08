const Groq = require('groq-sdk');
const { pool } = require('../config/database');

let _groq = null;
function getGroq() {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _groq;
}

async function getGameContext(gameId) {
  const gameRes = await pool.query(
    `SELECT g.*, c.name AS competition_name
     FROM games g LEFT JOIN competitions c ON c.id = g.competition_id
     WHERE g.id = $1`,
    [gameId]
  );
  if (!gameRes.rows[0]) throw new Error('Game not found');

  const questionsRes = await pool.query(
    `SELECT question_text, outcomes, is_locked FROM bet_questions WHERE game_id = $1 ORDER BY created_at ASC`,
    [gameId]
  );

  return { game: gameRes.rows[0], questions: questionsRes.rows };
}

function buildSystemPrompt(game, questions) {
  const statusLabel = {
    scheduled: 'טרם התחיל',
    live: `חי — דקה ${game.minute ?? '?'}`,
    finished: 'הסתיים',
  }[game.status] ?? game.status;

  const scoreStr = game.status !== 'scheduled'
    ? `תוצאה נוכחית: ${game.home_team} ${game.score_home ?? 0}–${game.score_away ?? 0} ${game.away_team}\n`
    : '';

  const questionsStr = questions
    .filter(q => !q.is_locked)
    .map(q => {
      const opts = (q.outcomes || []).map(o => `${o.label} (${o.odds}x)`).join(', ');
      return `  • ${q.question_text}: ${opts}`;
    })
    .join('\n') || '  אין שאלות פתוחות כרגע';

  return `אתה יועץ הימורי ידידותי של Kickoff — אפליקציית הימורי ספורט חברתית (נקודות בלבד, ללא כסף אמיתי).
תפקידך לעזור למשתמש לקבל החלטה מושכלת לפני שהוא מהמר על המשחק הספציפי הזה.

**משחק:**
  ${game.home_team} נגד ${game.away_team}
  ליגה: ${game.competition_name ?? 'לא ידוע'}
  מועד: ${new Date(game.start_time).toLocaleString('he-IL')}
  סטטוס: ${statusLabel}
${scoreStr}
**שאלות הימור פתוחות (עם אודס):**
${questionsStr}

**כללים:**
- ענה תמיד בעברית, בטון חברותי וקצר (עד 4 משפטים)
- אתה יועץ — לא נביא. ציין "על בסיס הנתונים הזמינים..." כשאתה מנתח
- אל תמציא סטטיסטיקות. אם אין לך מידע — אמור זאת בכנות
- התייחס לאודס כשרלוונטי: אודס גבוה = פחות צפוי = סיכון גבוה יותר`;
}

const DAILY_LIMIT = 20;

// Returns new count after increment, or null if limit exceeded
async function incrementUsage(userId) {
  const result = await pool.query(
    `INSERT INTO advisor_usage (user_id, usage_date, message_count)
     VALUES ($1, CURRENT_DATE, 1)
     ON CONFLICT (user_id, usage_date)
     DO UPDATE SET message_count = advisor_usage.message_count + 1
     WHERE advisor_usage.message_count < $2
     RETURNING message_count`,
    [userId, DAILY_LIMIT]
  );
  if (!result.rows || result.rows.length === 0) return null; // limit already hit
  return result.rows[0].message_count;
}

async function chat(gameId, userId, messages) {
  const newCount = await incrementUsage(userId);
  if (newCount === null) {
    const err = new Error('Rate limit exceeded');
    err.status = 429;
    throw err;
  }
  const remaining = DAILY_LIMIT - newCount;

  const { game, questions } = await getGameContext(gameId);
  const systemPrompt = buildSystemPrompt(game, questions);

  // Keep only the last 10 messages to limit token usage
  const trimmedMessages = messages.slice(-10);

  const completion = await getGroq().chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: systemPrompt },
      ...trimmedMessages,
    ],
    max_tokens: 350,
    temperature: 0.7,
  });

  return {
    reply: completion.choices[0].message.content,
    remaining,
  };
}

module.exports = { chat };
