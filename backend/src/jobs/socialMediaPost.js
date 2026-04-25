/**
 * socialMediaPost.js – cron job pipeline מדיה חברתית
 *
 * רץ 5:00 UTC (8:00 IST). מפעיל את orchestratorAgent.runDailySocialMediaPipeline()
 * שמריץ את כל הסוכנים ליצירת ופרסום פוסטים יומיים.
 */
'use strict';

const { initPipelineRun, runPipeline } = require('../agents/kernel/orchestrator');

module.exports = { 
  runDailySocialMediaPipeline: async ({ dryRun = false } = {}) => {
    console.log('[cron] Starting V2 Social Media Pipeline...');
    const { runId, isNew } = await initPipelineRun({ dryRun, isCron: true });
    if (isNew) {
      return runPipeline(runId);
    } else {
      console.log('[cron] Pipeline already ran today, skipping.');
    }
  }
};
