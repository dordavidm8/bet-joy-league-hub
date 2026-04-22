const { pool } = require('../../config/database');
const { getGroqClient, getSocialConfig, updateSocialConfig } = require('./socialMediaUtils');
const { runDailySocialMediaPipeline } = require('./orchestratorAgent');

const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_system_status",
      description: "Get the current system status and basic configuration.",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
  {
    type: "function",
    function: {
      name: "trigger_pipeline",
      description: "Trigger the daily social media pipeline manually now.",
      parameters: {
        type: "object",
        properties: {
          dryRun: { type: "boolean", description: "If true, don't publish real posts." }
        },
        required: ["dryRun"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_configuration",
      description: "Update the social media agent configuration keys.",
      parameters: {
        type: "object",
        properties: {
          key: { type: "string", enum: ["enabled", "auto_approve", "posting_time", "brand_voice"] },
          value: { type: "string" }
        },
        required: ["key", "value"]
      }
    }
  }
];

async function handleToolCall(toolCall, userEmail) {
  const name = toolCall.function.name;
  const args = JSON.parse(toolCall.function.arguments);

  try {
    if (name === 'get_system_status') {
      const config = await getSocialConfig();
      const lastRun = await pool.query('SELECT status, run_date FROM social_pipeline_runs ORDER BY started_at DESC LIMIT 1');
      return JSON.stringify({ config, lastRun: lastRun.rows[0] });
    }
    
    if (name === 'trigger_pipeline') {
      runDailySocialMediaPipeline({
        triggeredBy: 'manual',
        dryRun: args.dryRun,
        triggeredEmail: userEmail,
      }).catch(err => console.error('[ManagementChat] background trigger error', err.message));
      return JSON.stringify({ message: "Pipeline started successfully in the background." });
    }

    if (name === 'update_configuration') {
      await updateSocialConfig(args.key, args.value, userEmail);
      return JSON.stringify({ message: `Successfully updated ${args.key} to ${args.value}` });
    }

    return JSON.stringify({ error: "Unknown tool call" });
  } catch (err) {
    return JSON.stringify({ error: err.message });
  }
}

/**
 * Handle a chat message via Groq with tool calling.
 */
async function processManagementChat(userEmail, history, newMessage) {
  const config = await getSocialConfig();
  const groq = getGroqClient();

  const messages = [
    {
      role: 'system',
      content: `אתה יועץ ניהול סושיאל מדיה של KickOff — אפליקציית הימורי כדורגל חברתית ישראלית.
מצב נוכחי: מערכת ${config.enabled === 'true' ? 'פעילה' : 'כבויה'}. שעת פרסום: ${config.posting_time || '08:00'}.
אתה יכול להפעיל tools כדי לשנות הגדרות, לבדוק סטטוס, ולהפעיל את פייפליין יצירת התוכן. 
ענה בעברית, קצר ולעניין.`
    },
    ...history,
    { role: 'user', content: newMessage }
  ];

  const model = config.model || 'llama-3.3-70b-versatile';

  try {
    const response = await groq.chat.completions.create({
      model,
      messages,
      tools: TOOLS,
      tool_choice: "auto",
      max_tokens: 1000,
    });

    const responseMessage = response.choices[0].message;

    // Check if the model decided to call a tool
    if (responseMessage.tool_calls) {
      messages.push(responseMessage); // Add assistant's tool request to conversation
      
      for (const toolCall of responseMessage.tool_calls) {
        const toolResult = await handleToolCall(toolCall, userEmail);
        messages.push({
          tool_call_id: toolCall.id,
          role: "tool",
          name: toolCall.function.name,
          content: toolResult,
        });
      }

      // Second call to get the final natural language answer
      const secondResponse = await groq.chat.completions.create({
        model,
        messages,
      });
      return secondResponse.choices[0].message.content;
    }

    return responseMessage.content;
  } catch (err) {
    console.error('Groq Tool Calling Error:', err);
    throw new Error('שגיאה בתקשורת מול Groq');
  }
}

module.exports = {
  processManagementChat
};
