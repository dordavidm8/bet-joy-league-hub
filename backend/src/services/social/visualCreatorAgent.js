/**
 * visualCreatorAgent.js – סוכן יצירת ויזואל
 *
 * createVisualPrompt(context) –
 *   יוצר הנחיות מפורטות לתמונה/וידאו לפוסט.
 *   מתחשב ב: זהות המותג, צבעים, סגנון, תוכן המשחק.
 *   מפרט: מידות, רכיבים ויזואליים, overlays טקסט.
 */
'use strict';

const { getGeminiClient, callClaude, parseJsonResponse, getGroqClient } = require('./socialMediaUtils');
const {
  getTemplatesForCategory,
  buildSelectionPrompt,
  getAspectRatio,
  getPlatformBranding,
} = require('./promptLibraryService');

/**
 * Visual Creator Agent
 *
 * For each platform:
 *   1. Load curated Nano Banana Pro templates relevant to the content
 *   2. Ask Claude to SELECT the best template and ADAPT it for KickOff
 *   3. Generate the image via Gemini Imagen 3 using the adapted prompt
 *
 * This ensures every image uses a battle-tested, high-quality prompt structure.
 */
async function generateVisuals(ctx) {
  const startedAt = Date.now();
  const log = { startedAt, platforms: {} };

  try {
    // Run LinkedIn, Instagram, TikTok visual generation in parallel
    await Promise.allSettled([
      generatePlatformVisual(ctx, 'linkedin', log),
      generatePlatformVisual(ctx, 'instagram', log),
      generatePlatformVisual(ctx, 'tiktok', log),
    ]);

    log.finishedAt = Date.now();
    ctx.agentLog = ctx.agentLog || {};
    ctx.agentLog.visualCreator = log;
  } catch (err) {
    ctx.errors = ctx.errors || [];
    ctx.errors.push({ agent: 'visualCreator', error: err.message });
    ctx.agentLog = ctx.agentLog || {};
    ctx.agentLog.visualCreator = { startedAt, finishedAt: Date.now(), error: err.message };
  }
}

/**
 * Generate visual for a single platform using Nano Banana template selection.
 */
async function generatePlatformVisual(ctx, platform, log) {
  const platformData = ctx[platform];
  if (!platformData) return;

  const platformLog = { started: Date.now() };
  log.platforms[platform] = platformLog;

  const aspectRatio = getAspectRatio(platform);
  const platformBranding = getPlatformBranding(platform);

  // Build the concept hint from what we know about this post
  const conceptHint = buildConceptHint(ctx, platform);

  // ── Step 1: Load matching templates ─────────────────────────────────────
  const imagePromptHint = platformData.imagePrompt || platformData.videoPrompt || '';
  const { templates, category } = getTemplatesForCategory(
    platform,
    platformData.mediaType || 'image',
    `${conceptHint} ${imagePromptHint}`
  );

  platformLog.templateCategory = category;
  platformLog.templatesEvaluated = templates.length;

  // ── Step 2: Claude selects + adapts the best template ───────────────────
  const selectionSystem = `You are an expert visual prompt engineer for AI image generation models (Gemini Imagen 3 / Nano Banana Pro).
You understand what makes prompts produce photorealistic, stunning, social-media-ready images.
Always output JSON only.`;

  const selectionUserPrompt = buildSelectionPrompt(
    templates,
    `${conceptHint}\n\nOriginal concept: ${imagePromptHint}`,
    aspectRatio,
    platformBranding
  );

  const selectionResponse = await callClaude(selectionSystem, selectionUserPrompt, {
    temperature: 0.6,
    maxTokens: 2000,
  });

  const selection = parseJsonResponse(selectionResponse);

  if (!selection || !selection.finalPrompt) {
    // Fallback: use the first template's content as base, with simple enrichment
    platformLog.selectionFailed = true;
    const fallbackPrompt = await buildFallbackPrompt(ctx, platform, templates[0]);
    platformData.imagePrompt = fallbackPrompt;
    platformData.selectedTemplate = templates[0]?.title || 'fallback';
  } else {
    platformData.imagePrompt = selection.finalPrompt;
    platformData.selectedTemplate = selection.selectedTemplateTitle;
    platformLog.selectedTemplate = selection.selectedTemplateTitle;
    platformLog.selectionReason = selection.reason;
  }

  // ── Step 3: Generate image via Gemini Imagen 3 ───────────────────────────
  if (platform !== 'tiktok') {
    const imageResult = await generateImage(platformData.imagePrompt, aspectRatio, platform);
    platformData.imageUrl = imageResult;
    platformLog.imageGenerated = !!imageResult;
  } else {
    // TikTok: generate a thumbnail/cover image for the video
    platformData.videoPrompt = platformData.imagePrompt; // Store as video prompt
    const thumbResult = await generateImage(platformData.imagePrompt, '9:16', 'tiktok');
    platformData.thumbnailUrl = thumbResult;
    platformLog.thumbnailGenerated = !!thumbResult;
  }

  platformLog.finished = Date.now();
}

/**
 * Build a rich concept hint for Claude template selection.
 */
function buildConceptHint(ctx, platform) {
  const parts = [];

  if (ctx.weeklyTheme?.theme_he) {
    parts.push(`Weekly theme: ${ctx.weeklyTheme.theme_he} (${ctx.weeklyTheme.theme})`);
  }
  if (ctx.contentAngle?.angle) {
    parts.push(`Content angle: ${ctx.contentAngle.angle}`);
    parts.push(`Tone: ${ctx.contentAngle.tone}`);
  }
  if (ctx.todaysGames?.length > 0) {
    const gameStr = ctx.todaysGames.slice(0, 2).map(g => `${g.home_team} vs ${g.away_team}`).join(', ');
    parts.push(`Today's games: ${gameStr}`);
  }

  const platformData = ctx[platform];
  if (platformData?.caption) {
    parts.push(`Post caption preview: ${platformData.caption.slice(0, 100)}`);
  }

  parts.push('App: KickOff — Israeli social football betting platform');
  parts.push('Visual target: sporty, vibrant, premium, photorealistic');

  return parts.join('\n');
}

/**
 * Build a fallback prompt by enriching the first template's content.
 */
async function buildFallbackPrompt(ctx, platform, templateFallback) {
  const aspectRatio = getAspectRatio(platform);
  const baseContent = templateFallback?.content?.slice(0, 600) || 'A dynamic sports scene';

  return `${baseContent}

Adapted for KickOff — Israeli football betting platform.
Theme: ${ctx.weeklyTheme?.theme || 'Football Community'}
Style: vibrant, sporty, photorealistic, premium quality, ${aspectRatio} aspect ratio.
Colors: green (#4CAF50) accents, white, dark backgrounds.
Atmosphere: Israeli football culture, excitement, community.
Ultra-HD, cinematic lighting, sharp details.`;
}

/**
 * Generate a single image via Gemini Imagen 3.
 */
async function generateImage(prompt, aspectRatio = '1:1', platform = 'instagram') {
  try {
    const gemini = await getGeminiClient();

    // Gemini supports specific aspect ratios
    const validRatios = ['1:1', '16:9', '9:16', '4:3', '3:4'];
    const finalRatio = validRatios.includes(aspectRatio) ? aspectRatio : '1:1';

    const response = await gemini.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: prompt.slice(0, 4000), // Imagen 3 prompt limit
      config: {
        numberOfImages: 1,
        aspectRatio: finalRatio,
        safetyFilterLevel: 'BLOCK_SOME',
        personGeneration: 'ALLOW_ADULT',
      },
    });

    if (response.generatedImages && response.generatedImages.length > 0) {
      const imageBytes = response.generatedImages[0].image.imageBytes;
      return `data:image/png;base64,${imageBytes}`;
    }

    return null;
  } catch (err) {
    console.error(`[visualCreator] Imagen 3 error (${platform}):`, err.message);
    return null;
  }
}

module.exports = { generateVisuals };
