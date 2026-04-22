'use strict';

const path = require('path');
const fs = require('fs');

/**
 * Prompt Library Service
 *
 * Loads curated Nano Banana Pro prompt templates from the pre-extracted JSON
 * and provides Claude with the right set of templates for a given use-case.
 *
 * Template categories:
 *   - social_media_post  → Instagram / LinkedIn lifestyle posts
 *   - infographic        → Edu-visuals, stats comparisons
 *   - poster_flyer       → Brand posters, ads, product shots
 *   - profile_avatar     → Profile pics, mascots, character art
 *   - sports_content     → Football / sports-specific imagery
 *   - default            → Best overall templates (fallback)
 */

const TEMPLATES_PATH = path.join(__dirname, 'nano-banana-templates.json');

let _templates = null;

function loadTemplates() {
  if (_templates) return _templates;
  const raw = fs.readFileSync(TEMPLATES_PATH, 'utf-8');
  _templates = JSON.parse(raw);
  return _templates;
}

/**
 * Map platform + content type to the best template category
 */
function resolveCategory(platform, mediaType, contentHint = '') {
  const hint = contentHint.toLowerCase();

  // Football/sports keywords → sports_content
  if (
    hint.includes('football') || hint.includes('soccer') ||
    hint.includes('match') || hint.includes('player') ||
    hint.includes('goal') || hint.includes('כדורגל') ||
    hint.includes('שחקן') || hint.includes('ליגה')
  ) {
    return 'sports_content';
  }

  // Infographic signals
  if (
    hint.includes('infographic') || hint.includes('stats') ||
    hint.includes('statistics') || hint.includes('data') ||
    hint.includes('comparison') || hint.includes('explain')
  ) {
    return 'infographic';
  }

  // Poster / product / hype visuals
  if (
    hint.includes('poster') || hint.includes('banner') ||
    hint.includes('ad') || hint.includes('product') ||
    hint.includes('hype') || hint.includes('announce')
  ) {
    return 'poster_flyer';
  }

  // Profile / avatar
  if (
    hint.includes('avatar') || hint.includes('mascot') ||
    hint.includes('character') || hint.includes('logo') ||
    hint.includes('profile') || hint.includes('icon')
  ) {
    return 'profile_avatar';
  }

  // Default by platform
  return 'social_media_post';
}

/**
 * Build the template selection prompt for Claude.
 * Claude will receive N templates and choose + adapt the best one.
 */
function buildSelectionPrompt(templates, imageConceptHint, aspectRatio, platformBranding) {
  const templateList = templates
    .slice(0, 8) // Give Claude 8 candidates
    .map((t, i) => `[${i + 1}] ID:${t.id} | "${t.title}"\nDescription: ${t.description}\nTemplate Structure:\n${t.content.slice(0, 800)}...`)
    .join('\n\n---\n\n');

  return `You are a visual prompt engineer for KickOff — an Israeli sports betting app.
Your task: select the BEST Nano Banana Pro template from the list below and adapt it for maximum visual quality.

## Image Concept Goal
${imageConceptHint}

## Platform Requirements
- Aspect Ratio: ${aspectRatio || '1:1'}
- Brand Colors: Green (#4CAF50), white, dark accents
- Style: Modern, vibrant, sporty, premium
- Brand: KickOff — Israeli football betting community
${platformBranding}

## Available Templates
${templateList}

## Instructions
1. Choose the template number that best fits the image concept
2. Rewrite/adapt the template's content replacing placeholders with KickOff-specific visuals
3. Add: Israeli football atmosphere, KickOff brand energy, photorealistic quality
4. Do NOT include any text, logos, or watermarks in the image description
5. Make the final prompt as detailed and specific as possible

Return JSON ONLY:
{
  "selectedTemplateId": "template id",
  "selectedTemplateTitle": "title",
  "reason": "why this template fits best",
  "finalPrompt": "The complete, adapted, ready-to-use image generation prompt (min 150 words)"
}`;
}

/**
 * Main export: get top N templates for a given use-case
 */
function getTemplatesForCategory(platform, mediaType, contentHint = '') {
  const templates = loadTemplates();
  const category = resolveCategory(platform, mediaType, contentHint);

  // Primary category + fallback to default
  const primary = templates[category] || [];
  const fallback = templates['default'] || [];

  // Merge, dedupe by id, return top 8
  const seen = new Set();
  const merged = [];
  for (const t of [...primary, ...fallback]) {
    if (!seen.has(t.id)) {
      seen.add(t.id);
      merged.push(t);
    }
    if (merged.length >= 8) break;
  }

  return { templates: merged, category };
}

/**
 * Get the aspect ratio hint for each platform
 */
function getAspectRatio(platform) {
  switch (platform) {
    case 'linkedin':   return '16:9';
    case 'instagram':  return '1:1';
    case 'tiktok':     return '9:16';
    default:           return '1:1';
  }
}

/**
 * Get platform-specific branding guidance
 */
function getPlatformBranding(platform) {
  switch (platform) {
    case 'linkedin':
      return '- Style: Professional, data-driven, business-oriented\n- Audience: Sports professionals & enthusiasts, 25-45';
    case 'instagram':
      return '- Style: Eye-catching, vibrant, scroll-stopping\n- Audience: Football fans, 18-35';
    case 'tiktok':
      return '- Style: Dynamic, energetic, youth-oriented, cinematic\n- Audience: Gen-Z football fans, 16-28';
    default:
      return '';
  }
}

module.exports = {
  loadTemplates,
  getTemplatesForCategory,
  buildSelectionPrompt,
  getAspectRatio,
  getPlatformBranding,
  resolveCategory,
};
