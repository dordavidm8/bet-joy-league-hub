const { renderVideo } = require('./remotionRenderer');
const NotebookLMService = require('./notebookLmService');
const { generateImage } = require('./imageGen');
const hireAgent = require('./hireAgent');

/**
 * Tool Registry
 * Maps tool names as defined in SKILL.md to their implementation services.
 */
const toolMap = {
  'remotionRenderer': async (params) => await renderVideo(params),
  'notebookLmService': async (params) => {
    return params.format === 'slides'
      ? NotebookLMService.generateSlides(params)
      : NotebookLMService.generateAudio(params);
  },
  'notebookLmSlides': async (params) => await NotebookLMService.generateSlides(params),
  'imageGen': async (params) => await generateImage(params),
  'hireAgent': async (params, context) => await hireAgent(params, context),
  'hire_agent': async (params, context) => await hireAgent(params, context),
};

async function executeTool(toolName, params, context = {}) {
  const tool = toolMap[toolName];
  if (!tool) {
    throw new Error(`Tool "${toolName}" not found in registry. Available: ${Object.keys(toolMap).join(', ')}`);
  }
  return await tool(params, context);
}

module.exports = {
  toolMap,
  executeTool
};
