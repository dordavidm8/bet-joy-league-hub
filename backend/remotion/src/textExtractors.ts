/**
 * Remotion Text Extractors (Phase 7)
 * Maps composition inputProps to a human-readable list of scenes and texts for approval.
 */

const extractors = {
  'AppFeature': (p) => [
    { scene: 'כותרת פיצ׳ר', text: p.featureTitle || '' },
    { scene: 'תיאור פיצ׳ר', text: p.featureDescription || '' },
    { scene: 'קריאה לפעולה (CTA)', text: p.ctaText || '' },
  ],
  'GenericPromo': (p) => [
    { scene: 'פתיח', text: p.title || '' },
    { scene: 'תוכן מרכזי', text: p.subtitle || '' },
    { scene: 'סיום', text: p.footer || '' },
  ],
  'MatchTeaser': (p) => [
    { scene: 'משחק', text: `${p.homeTeam} vs ${p.awayTeam}` },
    { scene: 'תאריך/שעה', text: p.matchDate || '' },
    { scene: 'הימור מומלץ', text: p.betInsight || '' },
  ]
};

/**
 * Extracts human-readable scene texts for the approval gate.
 */
function extractTexts(compositionId, inputProps) {
  const extractor = extractors[compositionId];
  if (!extractor) {
    // Fallback: Dump all string values from props
    return Object.entries(inputProps)
      .filter(([_, v]) => typeof v === 'string' && v.length > 0)
      .map(([k, v]) => ({ scene: k, text: v }));
  }
  return extractor(inputProps);
}

module.exports = {
  extractTexts
};
