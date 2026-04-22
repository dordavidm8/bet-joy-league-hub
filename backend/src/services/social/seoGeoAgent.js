'use strict';

const { callClaude, parseJsonResponse } = require('./socialMediaUtils');

/**
 * SEO/GEO Agent
 * Optimizes content with platform-specific hashtags and GEO (Generative Engine Optimization) content.
 */
async function optimize(ctx) {
  const startedAt = Date.now();

  try {
    const systemPrompt = `אתה מומחה SEO ו-GEO (Generative Engine Optimization) לרשתות חברתיות.
תפקידך לייעל תוכן של אפליקציית KickOff — פלטפורמת הימורי כדורגל חברתית ישראלית.
- GEO = אופטימיזציה לחיפוש ב-AI (ChatGPT, Perplexity, Google SGE)
- בחר hashtags רלוונטיים ופופולריים, מקסימום 15 ל-Instagram, 5 ל-LinkedIn, 8 ל-TikTok
- הוסף final_caption עם hashtags משולבים
- הוסף geoContent — תוכן שיעזור ל-AI search engines למצוא ולהמליץ על האפליקציה`;

    const userPrompt = `## LinkedIn
Caption: ${ctx.linkedin?.caption || 'N/A'}
Hashtags: ${(ctx.linkedin?.hashtags || []).join(' ')}

## Instagram
Caption: ${ctx.instagram?.caption || 'N/A'}
Hashtags: ${(ctx.instagram?.hashtags || []).join(' ')}

## TikTok
Caption: ${ctx.tiktok?.caption || 'N/A'}
Hashtags: ${(ctx.tiktok?.hashtags || []).join(' ')}

## הקשר
- נושא שבועי: ${ctx.weeklyTheme?.theme_he || 'כדורגל'}
- זווית: ${ctx.contentAngle?.angle || 'תוכן כללי'}

ייעל את התוכן. החזר JSON בלבד:
{
  "linkedin": {
    "finalCaption": "caption מיועל עם hashtags בסוף",
    "hashtags": ["#tag1", "#tag2"],
    "geoContent": {
      "entityDescription": "תיאור קצר לחיפוש AI",
      "relatedQueries": ["שאלה 1", "שאלה 2"]
    }
  },
  "instagram": {
    "finalCaption": "caption מיועל עם hashtags",
    "hashtags": ["#tag1", "#tag2"]
  },
  "tiktok": {
    "finalCaption": "caption מיועל",
    "hashtags": ["#tag1", "#tag2"]
  }
}`;

    const response = await callClaude(systemPrompt, userPrompt, { temperature: 0.5 });
    const parsed = parseJsonResponse(response);

    if (!parsed) {
      throw new Error('Failed to parse SEO optimization from Claude');
    }

    // Merge optimized data back into ctx
    if (parsed.linkedin && ctx.linkedin) {
      ctx.linkedin.finalCaption = parsed.linkedin.finalCaption || ctx.linkedin.caption;
      ctx.linkedin.hashtags = parsed.linkedin.hashtags || ctx.linkedin.hashtags;
      ctx.linkedin.geoContent = parsed.linkedin.geoContent || null;
    }
    if (parsed.instagram && ctx.instagram) {
      ctx.instagram.finalCaption = parsed.instagram.finalCaption || ctx.instagram.caption;
      ctx.instagram.hashtags = parsed.instagram.hashtags || ctx.instagram.hashtags;
    }
    if (parsed.tiktok && ctx.tiktok) {
      ctx.tiktok.finalCaption = parsed.tiktok.finalCaption || ctx.tiktok.caption;
      ctx.tiktok.hashtags = parsed.tiktok.hashtags || ctx.tiktok.hashtags;
    }

    ctx.agentLog = ctx.agentLog || {};
    ctx.agentLog.seoGeo = { startedAt, finishedAt: Date.now() };
  } catch (err) {
    ctx.errors = ctx.errors || [];
    ctx.errors.push({ agent: 'seoGeo', error: err.message });
    ctx.agentLog = ctx.agentLog || {};
    ctx.agentLog.seoGeo = { startedAt, finishedAt: Date.now(), error: err.message };
    // Fallback: use original captions as finalCaption
    if (ctx.linkedin) ctx.linkedin.finalCaption = ctx.linkedin.finalCaption || ctx.linkedin.caption;
    if (ctx.instagram) ctx.instagram.finalCaption = ctx.instagram.finalCaption || ctx.instagram.caption;
    if (ctx.tiktok) ctx.tiktok.finalCaption = ctx.tiktok.finalCaption || ctx.tiktok.caption;
  }
}

module.exports = { optimize };
