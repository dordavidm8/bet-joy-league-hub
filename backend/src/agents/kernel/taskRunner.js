const eventBus = require('./eventBus');
const { pool } = require('../../config/database');
const { callGroqPipeline } = require('../tools/groqClient');

/**
 * Task Runner
 * Handles actual execution of tasks, backoff loops, and statuses.
 */
async function executeTask(task, skill, tools) {
  try {
    eventBus.emit('stage_started', { runId: task.run_id, skillName: skill.name, stage: task.stage });
    
    // Update DB
    await pool.query(`UPDATE agent_tasks SET status = 'running', started_at = NOW() WHERE id = $1`, [task.id]);

    // Build the Prompt using instructions and reference files
    let systemPrompt = skill.instructions || '';
    // Sort references by keys to force deterministic ordering
    if (skill.references) {
       const keys = Object.keys(skill.references).sort();
       for (const refName of keys) {
         systemPrompt += `\n\n--- REFERENCE: ${refName} ---\n${skill.references[refName]}\n-----------------------`;
       }
    }
    
    const JSON_MODE = skill.metadata?.output?.toLowerCase() === 'json' || skill.output?.toLowerCase() === 'json';

    // The previous context input translated to Hebrew
    const userPrompt = `הנה הקונטקסט שהועבר אליך מהשלב הקודם (ויש להסתמך עליו לצורך כך):\n${JSON.stringify(task.input, null, 2)}\n\nאנא בצע את תפקידך בהתאם להנחיות.${JSON_MODE ? ' חובה עליך להחזיר רק אובייקט JSON תקין לחלוטין וללא שום הקדמה מילולית.' : ''}`;

    // Execute Groq with 3 attempts backoff
    let groqResult;
    let attempts = 0;
    while (attempts < 3) {
      try {
        groqResult = await callGroqPipeline(systemPrompt, userPrompt, { jsonMode: JSON_MODE });
        if (groqResult.success) break;
        attempts++;
        if (attempts >= 3) throw new Error(groqResult.error);
        await new Promise(r => setTimeout(r, 2000 * attempts));
      } catch(e) {
        attempts++;
        if (attempts >= 3) throw e;
        await new Promise(r => setTimeout(r, 2000 * attempts));
      }
    }
    
    // Bug #5 Fix: Guard against parsing if already an object (prevents 'Cannot read property of string' error)
    let parsedText = groqResult.text;
    if (JSON_MODE) {
      if (typeof parsedText === 'string') {
        try {
          parsedText = JSON.parse(parsedText);
        } catch (e) {
          console.warn('[taskRunner] JSON_MODE requested but LLM returned non-JSON, storing raw string:', e.message);
        }
      }
      // If it's already an object (sdk parsed it), use it directly
    }
    
    // Inject budget tracking
    const output = { 
      generated: true, 
      text: parsedText, 
      budget: groqResult.usage,
      timestamp: Date.now() 
    };

    await pool.query(`UPDATE agent_tasks SET status = 'success', output = $1, finished_at = NOW() WHERE id = $2`, [JSON.stringify(output), task.id]);
    eventBus.emit('stage_completed', { runId: task.run_id, skillName: skill.name, stage: task.stage, output });

    return { success: true, output };
  } catch (err) {
    console.error(`[taskRunner] Task failed:`, err);
    await pool.query(`UPDATE agent_tasks SET status = 'failed', error = $1, finished_at = NOW() WHERE id = $2`, [err.message, task.id]);
    eventBus.emit('stage_failed', { runId: task.run_id, skillName: skill.name, stage: task.stage, error: err.message });
    return { success: false, error: err.message };
  }
}

module.exports = {
  executeTask
};
