/**
 * contentCalendarAgent.js – סוכן תכנון לוח שנה תוכן
 *
 * planWeeklyTheme(context) –
 *   משתמש ב-LLM לתכנון נושא שבועי לפוסטים.
 *   מתחשב ב: משחקים קרובים, מגמות, עונה בכדורגל.
 *   מוסיף ל-context: weeklyTheme, contentAngles
 */
'use strict';

const { pool } = require('../../config/database');
const { callClaude, parseJsonResponse } = require('./socialMediaUtils');

/**
 * Content Calendar Agent
 * Generates a weekly theme and sub-topics for social media content.
 * Caches results per ISO week in social_content_calendar.
 */

function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

async function getWeeklyTheme(ctx) {
  const startedAt = Date.now();
  const weekStart = getWeekStart();

  try {
    // Check cache
    const cached = await pool.query(
      `SELECT theme, theme_he, sub_topics FROM social_content_calendar WHERE week_start = $1`,
      [weekStart]
    );

    if (cached.rows.length > 0) {
      ctx.weeklyTheme = {
        theme: cached.rows[0].theme,
        theme_he: cached.rows[0].theme_he,
        subTopics: cached.rows[0].sub_topics,
      };
      ctx.agentLog = ctx.agentLog || {};
      ctx.agentLog.contentCalendar = { startedAt, finishedAt: Date.now(), cached: true };
      return;
    }

    // Generate via Claude
    const systemPrompt = `אתה מנהל תוכן לאפליקציית KickOff — פלטפורמת הימורי כדורגל חברתית ישראלית.
תפקידך לתכנן נושא שבועי לתוכן ברשתות חברתיות.
הנושא צריך להיות רלוונטי לעולם הכדורגל, מעניין לקהל ישראלי צעיר, ולקדם את האפליקציה.`;

    const userPrompt = `היום: ${new Date().toLocaleDateString('he-IL')}
שבוע מתחיל ב: ${weekStart}

${ctx.todaysGames ? `משחקים השבוע:\n${ctx.todaysGames.map(g => `${g.home_team} vs ${g.away_team}`).join('\n')}` : 'אין עדיין מידע על משחקים.'}

צור נושא שבועי לתוכן ברשתות חברתיות.
החזר JSON בלבד:
{
  "theme": "Weekly theme name in English",
  "theme_he": "שם הנושא בעברית",
  "subTopics": ["נושא משנה 1", "נושא משנה 2", "נושא משנה 3", "נושא משנה 4", "נושא משנה 5"]
}`;

    const response = await callClaude(systemPrompt, userPrompt, { temperature: 0.8 });
    const parsed = parseJsonResponse(response);

    if (!parsed || !parsed.theme) {
      throw new Error('Failed to parse weekly theme from Claude response');
    }

    ctx.weeklyTheme = {
      theme: parsed.theme,
      theme_he: parsed.theme_he || parsed.theme,
      subTopics: parsed.subTopics || [],
    };

    // Save to cache
    await pool.query(
      `INSERT INTO social_content_calendar (week_start, theme, theme_he, sub_topics)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (week_start) DO UPDATE SET theme = $2, theme_he = $3, sub_topics = $4`,
      [weekStart, ctx.weeklyTheme.theme, ctx.weeklyTheme.theme_he, JSON.stringify(ctx.weeklyTheme.subTopics)]
    );

    ctx.agentLog = ctx.agentLog || {};
    ctx.agentLog.contentCalendar = { startedAt, finishedAt: Date.now(), cached: false, theme: ctx.weeklyTheme.theme };
  } catch (err) {
    ctx.errors = ctx.errors || [];
    ctx.errors.push({ agent: 'contentCalendar', error: err.message });
    ctx.agentLog = ctx.agentLog || {};
    ctx.agentLog.contentCalendar = { startedAt, finishedAt: Date.now(), error: err.message };
    // Set fallback theme
    ctx.weeklyTheme = ctx.weeklyTheme || {
      theme: 'Football Community',
      theme_he: 'קהילת הכדורגל',
      subTopics: [],
    };
  }
}

module.exports = { getWeeklyTheme };
