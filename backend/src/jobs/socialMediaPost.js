/**
 * socialMediaPost.js – cron job pipeline מדיה חברתית
 *
 * רץ 5:00 UTC (8:00 IST). מפעיל את orchestratorAgent.runDailySocialMediaPipeline()
 * שמריץ את כל הסוכנים ליצירת ופרסום פוסטים יומיים.
 */
'use strict';

const { runDailySocialMediaPipeline } = require('../services/social/orchestratorAgent');

module.exports = { runDailySocialMediaPipeline };
