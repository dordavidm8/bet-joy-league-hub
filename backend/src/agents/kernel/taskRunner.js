const eventBus = require('./eventBus');
const { agentsPool: pool } = require('../../config/database');
const { callGroqPipeline } = require('../tools/groqClient');
const KnowledgeManager = require('./knowledgeManager');
const { executeTool } = require('../tools/toolRegistry');
const Budget = require('./budget');
const TicketManager = require('./ticketManager');
const ApprovalGate = require('./approvalGate');
const { extractTexts } = require('../../remotion/src/textExtractors');

/**
 * Task Runner
 * Handles actual execution of tasks, backoff loops, and statuses.
 */
async function executeTask(task, skill) {
  try {
    // Stage E Prep: Check budget
    const hasBudget = await Budget.checkBudget(skill.name);
    if (!hasBudget) throw new Error(`Budget exceeded for agent ${skill.name}`);

    eventBus.emit('stage_started', { runId: task.run_id, skillName: skill.name, stage: task.stage });
    
    // Update DB
    await pool.query(`UPDATE agent_tasks SET status = 'running', started_at = NOW() WHERE id = $1`, [task.id]);

    // Handle input parsing if it's a string (Point #5)
    let input = task.input;
    if (typeof input === 'string') {
      try { input = JSON.parse(input); } catch(e) { input = {}; }
    }

    // 1. FETCH KNOWLEDGE & MEMORIES (Phase 4: Paperclip)
    const assets = await KnowledgeManager.getActiveAssets();
    const memories = await KnowledgeManager.searchMemories(skill.name, 3);
    
    const knowledgeContext = `
CORE KNOWLEDGE ASSETS:
${assets.map(a => `- ${a.title}: ${a.raw_content || JSON.stringify(a.metadata)}`).join('\n')}

PAST RELEVANT MEMORIES:
${memories.map(m => `[${m.created_at}] ${m.entity_key}: ${m.content}`).join('\n')}
    `;

    // Build the Prompt using instructions and reference files
    let systemPrompt = (skill.instructions || '') + "\n\n" + knowledgeContext + "\n\nIMPORTANT: Use the provided knowledge to ensure consistency.";
    if (skill.references) {
       const keys = Object.keys(skill.references).sort();
       for (const refName of keys) {
         systemPrompt += `\n\n--- REFERENCE: ${refName} ---\n${skill.references[refName]}\n-----------------------`;
       }
    }
    
    const JSON_MODE = skill.metadata?.output?.toLowerCase() === 'json' || skill.output?.toLowerCase() === 'json';

    const userPrompt = `הנה הקונטקסט שהועבר אליך מהשלב הקודם (ויש להסתמך עליו לצורך כך):\n${JSON.stringify(input, null, 2)}\n\nאנא בצע את תפקידך בהתאם להנחיות.${JSON_MODE ? ' חובה עליך להחזיר רק אובייקט JSON תקין לחלוטין וללא שום הקדמה מילולית.' : ''}`;

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
    
    // Stage E Prep: Charge for tokens used
    if (groqResult.usage && groqResult.usage.total_tokens) {
      await Budget.chargeBudget(skill.name, groqResult.usage.total_tokens);
    }
    
    let parsedText = groqResult.text;
    if (JSON_MODE) {
      if (typeof parsedText === 'string') {
        try {
          parsedText = JSON.parse(parsedText);
        } catch (e) {
          console.warn('[taskRunner] JSON_MODE requested but LLM returned non-JSON, storing raw string:', e.message);
        }
      }
    }
    
    // Budget tracking (Phase 4)
    if (groqResult.usage) {
      const tokens = groqResult.usage.total_tokens || 0;
      const ratePer1M = 0.59; 
      const cost = (tokens / 1000000) * ratePer1M;
      
      await pool.query(
        `UPDATE social_pipeline_runs 
         SET total_tokens_used = total_tokens_used + $1, 
             estimated_cost_usd = estimated_cost_usd + $2 
         WHERE id = $3`,
        [tokens, cost, task.run_id]
      );
    }

    const output = {
      generated: true,
      text: parsedText,
      budget: groqResult.usage,
      timestamp: Date.now()
    };

    // Persistence (Phase 4: Automatic Memory Extraction)
    if (parsedText && typeof parsedText === 'object') {
      const potentialMemories = parsedText.memories || parsedText.learnings;
      if (Array.isArray(potentialMemories)) {
        for (const m of potentialMemories) {
          if (m.key && m.content) {
            await KnowledgeManager.remember(task.run_id, skill.name, m.key, m.content, m.type || 'insight', m.importance || 5);
          }
        }
      }

      // PHASE 5: TOOL DISPATCHING (Media Production)
      if (parsedText.tool && parsedText.args) {
        const toolName = parsedText.tool;
        const toolArgs = parsedText.args;
        
        try {
          // 1. Initial Job Logging
          const jobRes = await pool.query(
            `INSERT INTO media_jobs (run_id, tool_name, status, input_params) VALUES ($1, $2, $3, $4) RETURNING id`,
            [task.run_id, toolName, 'started', JSON.stringify(toolArgs)]
          );
          const jobId = jobRes.rows[0].id;

          // PHASE 7: VIDEO TEXT APPROVAL LOOP
          if (toolName === 'remotionRenderer') {
            console.log('🛑 [TaskRunner] Intercepting Remotion render for human approval...');
            const texts = extractTexts(toolArgs.compositionId, toolArgs.inputProps);
            
            await ApprovalGate.requestApproval({
              issueId: input?.issueId || null,
              requestType: 'video_text_review',
              requestedBy: skill.name,
              payload: { 
                compositionId: toolArgs.compositionId, 
                inputProps: toolArgs.inputProps, 
                texts, 
                runId: task.run_id, 
                jobId 
              }
            });

            await pool.query(`UPDATE agent_tasks SET status = 'awaiting_approval' WHERE id = $1`, [task.id]);
            eventBus.emit('stage_completed', { 
              runId: task.run_id, 
              skillName: skill.name, 
              stage: task.stage, 
              output: { status: 'awaiting_approval', message: 'Video text review submitted.' } 
            });
            return { success: true, waiting: true }; 
          }

          // 2. Execute Tool (Merge context into params - Point #3)
          const toolResult = await executeTool(toolName, { 
            ...toolArgs,
            runId: task.run_id,
            jobId: jobId,
            skillName: skill.name,
            issueId: input?.issueId || null,
            companyId: input?.companyId || null
          });
          
          eventBus.emit('log', { runId: task.run_id, skillName: skill.name, message: `🎬 Tool executed: ${toolName}` });
          output.media = toolResult; 
          output.media_job_id = jobId;
        } catch (toolError) {
          console.error('[taskRunner] Tool execution failed:', toolError.message);
          eventBus.emit('log', { runId: task.run_id, skillName: skill.name, message: `❌ Tool failed: ${toolError.message}`, type: 'error' });
        }
      }
    }

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
