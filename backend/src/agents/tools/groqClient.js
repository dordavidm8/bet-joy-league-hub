/**
 * Tools: Groq Client Wrapper
 * Extracts LLM interactions for Agents.
 */
const { Groq } = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function callGroqPipeline(systemPrompt, userPrompt, config = {}) {
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      model: config.model || 'llama-3.3-70b-versatile',
      temperature: config.temperature || 0.7,
      max_tokens: config.max_tokens || 8192,
      response_format: config.jsonMode ? { type: "json_object" } : { type: "text" }
    });

    const text = chatCompletion.choices[0]?.message?.content || '';
    const usage = chatCompletion.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    return { success: true, text, usage };
  } catch (err) {
    console.error('Groq Execution Error:', err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  callGroqPipeline
};
