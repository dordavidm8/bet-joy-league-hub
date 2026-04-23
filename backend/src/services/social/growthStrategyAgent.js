/**
 * growthStrategyAgent.js – סוכן אסטרטגיית צמיחה
 *
 * analyzeGrowth(context) –
 *   מנתח ביצועי פוסטים קודמים ומגבש המלצות לצמיחה.
 *   מזהה: סוגי תוכן שמצליחים, שעות פרסום אופטימליות,
 *   קהל יעד, מתחרים.
 */
'use strict';

const { pool } = require('../../config/database');
const {
  callClaude, parseJsonResponse,
  formatGamesForPrompt, formatKnowledgeBaseForPrompt, formatMemoriesForPrompt,
} = require('./socialMediaUtils');

/**
 * Growth Strategy Agent
 * Analyzes app data, trending topics and competitor insights to recommend a content angle.
 */
async function analyzeAndRecommend(ctx) {
  const startedAt = Date.now();

  try {
    // Fetch app stats
    const [usersRes, betsRes, leaguesRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS new_7d FROM users`),
      pool.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE placed_at > NOW() - INTERVAL '24 hours') AS last_24h FROM bets`),
      pool.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS new_7d FROM leagues`),
    ]);

    const appStats = {
      totalUsers: parseInt(usersRes.rows[0].total),
      newUsers7d: parseInt(usersRes.rows[0].new_7d),
      totalBets: parseInt(betsRes.rows[0].total),
      betsLast24h: parseInt(betsRes.rows[0].last_24h),
      totalLeagues: parseInt(leaguesRes.rows[0].total),
      newLeagues7d: parseInt(leaguesRes.rows[0].new_7d),
    };

    const systemPrompt = `אתה אסטרטג שיווק דיגיטלי לאפליקציית KickOff — פלטפורמת הימורי כדורגל חברתית ישראלית.
תפקידך לנתח נתונים ולהמליץ על זווית תוכן יומית שתמקסם מעורבות וצמיחה.
התוכן מיועד לקהל ישראלי צעיר (18-35) שאוהב כדורגל.`;

    const gamesStr = formatGamesForPrompt(ctx.todaysGames || []);
    const memoriesStr = formatMemoriesForPrompt(ctx.unifiedMemory || []);

    const userPrompt = `## נתוני האפליקציה
- משתמשים: ${appStats.totalUsers} (${appStats.newUsers7d} חדשים השבוע)
- הימורים: ${appStats.totalBets} (${appStats.betsLast24h} ב-24 שעות אחרונות)
- ליגות: ${appStats.totalLeagues} (${appStats.newLeagues7d} חדשות השבוע)

## נושא שבועי
${ctx.weeklyTheme ? `${ctx.weeklyTheme.theme_he} (${ctx.weeklyTheme.theme})` : 'לא נקבע'}

## משחקים היום
${gamesStr}

${memoriesStr ? `## תובנות מהזיכרון\n${memoriesStr}` : ''}

${ctx.competitorInsights ? `## תובנות ממתחרים\n${JSON.stringify(ctx.competitorInsights).slice(0, 500)}` : ''}

המלץ על זווית תוכן יומית. החזר JSON בלבד:
{
  "angle": "תיאור הזווית בעברית",
  "angleEn": "Angle description in English",
  "reason": "למה הזווית הזו טובה",
  "tone": "playful|informative|hype|emotional|competitive",
  "targetMetric": "engagement|reach|conversions|brand_awareness",
  "keyStats": ["סטטיסטיקה 1", "סטטיסטיקה 2"]
}`;

    const response = await callClaude(systemPrompt, userPrompt, { temperature: 0.7 });
    const parsed = parseJsonResponse(response);

    if (!parsed || !parsed.angle) {
      throw new Error('Failed to parse content angle from Claude');
    }

    ctx.contentAngle = {
      angle: parsed.angle,
      angleEn: parsed.angleEn || parsed.angle,
      reason: parsed.reason || '',
      tone: parsed.tone || 'playful',
      targetMetric: parsed.targetMetric || 'engagement',
      keyStats: parsed.keyStats || [],
    };

    ctx.agentLog = ctx.agentLog || {};
    ctx.agentLog.growthStrategy = { startedAt, finishedAt: Date.now(), angle: ctx.contentAngle.angleEn, appStats };
  } catch (err) {
    ctx.errors = ctx.errors || [];
    ctx.errors.push({ agent: 'growthStrategy', error: err.message });
    ctx.agentLog = ctx.agentLog || {};
    ctx.agentLog.growthStrategy = { startedAt, finishedAt: Date.now(), error: err.message };
    // Fallback
    ctx.contentAngle = ctx.contentAngle || {
      angle: 'תוכן כללי על כדורגל',
      angleEn: 'General football content',
      reason: 'Fallback due to error',
      tone: 'playful',
      targetMetric: 'engagement',
      keyStats: [],
    };
  }
}

module.exports = { analyzeAndRecommend };
