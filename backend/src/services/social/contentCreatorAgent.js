/**
 * contentCreatorAgent.js – סוכן כתיבת תוכן
 *
 * createContent(context) –
 *   כותב כיתוב לפוסט עבור כל פלטפורמה (LinkedIn, Instagram, TikTok).
 *   משתמש ב: brand voice, נושא שבועי, אסטרטגיית צמיחה.
 *   LinkedIn: מקצועי | Instagram: קליל | TikTok: טרנדי
 */
'use strict';

const {
  callClaude, parseJsonResponse,
  formatGamesForPrompt, formatKnowledgeBaseForPrompt, formatMemoriesForPrompt,
} = require('./socialMediaUtils');

/**
 * Content Creator Agent
 * Generates captions for LinkedIn, Instagram, and TikTok via 3 Claude calls.
 */
async function generateContent(ctx) {
  const startedAt = Date.now();

  try {
    const gamesStr = formatGamesForPrompt(ctx.todaysGames || []);
    const kbStr = formatKnowledgeBaseForPrompt(ctx.knowledgeBase || []);
    const memoriesStr = formatMemoriesForPrompt(ctx.unifiedMemory || []);

    const sharedContext = `## הקשר
- נושא שבועי: ${ctx.weeklyTheme?.theme_he || 'כדורגל'}
- זווית יומית: ${ctx.contentAngle?.angle || 'תוכן כללי'}
- טון: ${ctx.contentAngle?.tone || 'playful'}
- סטטיסטיקות: ${(ctx.contentAngle?.keyStats || []).join(', ') || 'אין'}

## משחקים היום
${gamesStr}

${kbStr ? `## ידע מותג\n${kbStr}` : ''}
${memoriesStr ? `## זיכרון\n${memoriesStr}` : ''}`;

    const baseSystem = `אתה קופירייטר מוכשר שכותב תוכן לרשתות חברתיות של KickOff — פלטפורמת הימורי כדורגל חברתית ישראלית.
כתוב בעברית, hashtags באנגלית. השתמש באימוג'ים. הטון: ${ctx.contentAngle?.tone || 'playful'}.
כלול CTA ברור (הורדת האפליקציה / הצטרפות לליגה / שחקו עכשיו).`;

    // ── LinkedIn ────────────────────
    const linkedinPrompt = `${sharedContext}

כתוב פוסט ל-LinkedIn (מקצועי + מעניין, 150-300 מילים).
דגשים: טון מקצועי יותר, תובנות על הכדורגל/טכנולוגיה, קהילה.
כלול קריאה לפעולה.

החזר JSON בלבד:
{
  "caption": "טקסט הפוסט בעברית",
  "hashtags": ["#Football", "#Betting", "#SportsApp"],
  "imagePrompt": "English prompt for image generation — photorealistic, vibrant",
  "mediaType": "image"
}`;

    // ── Instagram ───────────────────
    const instagramPrompt = `${sharedContext}

כתוב פוסט ל-Instagram (ויזואלי, קצר וקליט, עד 100 מילים).
דגשים: hook חזק בשורה ראשונה, אימוג'ים, ויראליות.

החזר JSON בלבד:
{
  "caption": "טקסט הפוסט בעברית",
  "hashtags": ["#Football", "#KickOff", "#Soccer"],
  "imagePrompt": "English prompt for image generation — eye-catching, social media style",
  "mediaType": "image"
}`;

    // ── TikTok ──────────────────────
    const tiktokPrompt = `${sharedContext}

כתוב סקריפט לסרטון TikTok (15-30 שניות).
דגשים: hook חזק ב-3 שניות ראשונות, טקסטים על המסך, CTA.

החזר JSON בלבד:
{
  "caption": "תיאור קצר לפוסט בעברית",
  "hashtags": ["#Football", "#SportsBetting", "#FYP"],
  "script": "סקריפט מפורט",
  "hookHe": "משפט פתיחה בעברית (hook)",
  "hookEn": "Opening hook in English",
  "overlayLines": ["שורת טקסט 1", "שורת טקסט 2", "שורת טקסט 3"],
  "cta": "קריאה לפעולה",
  "videoPrompt": "English prompt for video generation",
  "mediaType": "video"
}`;

    // Run all 3 in parallel
    const [linkedinRaw, instagramRaw, tiktokRaw] = await Promise.all([
      callClaude(baseSystem, linkedinPrompt, { temperature: 0.8 }),
      callClaude(baseSystem, instagramPrompt, { temperature: 0.8 }),
      callClaude(baseSystem, tiktokPrompt, { temperature: 0.8 }),
    ]);

    const linkedin = parseJsonResponse(linkedinRaw);
    const instagram = parseJsonResponse(instagramRaw);
    const tiktok = parseJsonResponse(tiktokRaw);

    if (!linkedin || !instagram || !tiktok) {
      throw new Error('Failed to parse one or more content responses');
    }

    ctx.linkedin = {
      caption: linkedin.caption,
      hashtags: linkedin.hashtags || [],
      imagePrompt: linkedin.imagePrompt,
      mediaType: linkedin.mediaType || 'image',
    };

    ctx.instagram = {
      caption: instagram.caption,
      hashtags: instagram.hashtags || [],
      imagePrompt: instagram.imagePrompt,
      mediaType: instagram.mediaType || 'image',
    };

    ctx.tiktok = {
      caption: tiktok.caption,
      hashtags: tiktok.hashtags || [],
      script: tiktok.script,
      hookHe: tiktok.hookHe,
      hookEn: tiktok.hookEn,
      overlayLines: tiktok.overlayLines || [],
      cta: tiktok.cta,
      videoPrompt: tiktok.videoPrompt,
      mediaType: tiktok.mediaType || 'video',
    };

    ctx.agentLog = ctx.agentLog || {};
    ctx.agentLog.contentCreator = {
      startedAt, finishedAt: Date.now(),
      linkedinLength: (linkedin.caption || '').length,
      instagramLength: (instagram.caption || '').length,
      tiktokScriptLength: (tiktok.script || '').length,
    };
  } catch (err) {
    ctx.errors = ctx.errors || [];
    ctx.errors.push({ agent: 'contentCreator', error: err.message });
    ctx.agentLog = ctx.agentLog || {};
    ctx.agentLog.contentCreator = { startedAt, finishedAt: Date.now(), error: err.message };
  }
}

module.exports = { generateContent };
