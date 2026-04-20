const Groq = require('groq-sdk');
const { pool } = require('../config/database');
const { getSecret } = require('../lib/secrets');
const { TOOL_SCHEMAS, TOOL_FN_MAP } = require('./advisorTools');
const { logEvent } = require('./advisorMetrics');

const MAX_ITERATIONS = 4;
const DAILY_LIMIT = 20;

let _groqClient = null;
let _groqKeyUsed = null;

async function getGroq() {
  const key = await getSecret('GROQ_API_KEY');
  if (!key) throw new Error('GROQ_API_KEY is not configured');
  if (_groqClient && _groqKeyUsed === key) return _groqClient;
  _groqClient = new Groq({ apiKey: key });
  _groqKeyUsed = key;
  return _groqClient;
}

async function getConfig() {
  try {
    const res = await pool.query('SELECT key, value FROM advisor_config');
    return Object.fromEntries(res.rows.map(r => [r.key, r.value]));
  } catch {
    return { model: 'llama-3.3-70b-versatile', temperature: '0.7', max_tokens: '600', system_prompt: '' };
  }
}

async function getGameContext(gameId, skipStatusCheck = false) {
  const gameRes = await pool.query(
    `SELECT g.*, c.name AS competition_name
     FROM games g LEFT JOIN competitions c ON c.id = g.competition_id
     WHERE g.id = $1`,
    [gameId]
  );
  if (!gameRes.rows[0]) throw new Error('Game not found');

  const game = gameRes.rows[0];

  // Validate game status is scheduled (unless explicitly skipped for admin playground)
  if (!skipStatusCheck && game.status !== 'scheduled') {
    const statusErrors = {
      'live': 'לא ניתן לשאול על משחק חי - השתמש בעמוד המשחק',
      'finished': 'לא ניתן לשאול על משחק שנגמר',
      'postponed': 'המשחק נדחה - המתן לעדכון מועד חדש',
      'cancelled': 'המשחק בוטל'
    };
    const message = statusErrors[game.status] || `משחק בסטטוס '${game.status}' לא זמין ליועץ`;
    const err = new Error(message);
    err.status = 403;
    throw err;
  }

  const questionsRes = await pool.query(
    `SELECT question_text, outcomes, is_locked FROM bet_questions WHERE game_id = $1 ORDER BY created_at ASC`,
    [gameId]
  );
  return { game, questions: questionsRes.rows };
}

function buildSystemPrompt(cfg, game, questions) {
  const base = cfg.system_prompt || 'אתה יועץ הימורי של Kickoff. ענה תמיד בעברית, בטון חברותי וקצר. אל תמציא סטטיסטיקות.';

  if (!game) return base;

  const statusLabel = { scheduled: 'טרם התחיל', live: `חי — דקה ${game.minute ?? '?'}`, finished: 'הסתיים' }[game.status] ?? game.status;
  const scoreStr = game.status !== 'scheduled' ? `תוצאה נוכחית: ${game.home_team} ${game.score_home ?? 0}–${game.score_away ?? 0} ${game.away_team}\n` : '';
  const questionsStr = questions
    .filter(q => !q.is_locked)
    .map(q => {
      const opts = (q.outcomes || []).map(o => `${o.label} (${o.odds}x)`).join(', ');
      return `  • ${q.question_text}: ${opts}`;
    }).join('\n') || '  אין שאלות פתוחות';

  return `${base}

משחק: ${game.home_team} נגד ${game.away_team} | ${game.competition_name ?? ''} | ${statusLabel}
${scoreStr}שאלות הימור: ${questionsStr}

כלים זמינים לשליפת נתונים — השתמש בהם כדי לגבות כל טענה בנתונים אמיתיים.
אחרי שסיימת לאסוף נתונים, כתוב תשובה סופית בעברית ללא markdown.`;
}

async function incrementUsage(userId) {
  const limit = parseInt((await getConfig()).daily_limit ?? '20');
  const result = await pool.query(
    `INSERT INTO advisor_usage (user_id, usage_date, message_count)
     VALUES ($1, CURRENT_DATE, 1)
     ON CONFLICT (user_id, usage_date)
     DO UPDATE SET message_count = advisor_usage.message_count + 1
     WHERE advisor_usage.message_count < $2
     RETURNING message_count`,
    [userId, limit]
  );
  if (!result.rows || result.rows.length === 0) return null;
  return { count: result.rows[0].message_count, limit };
}

// ── Agent loop (non-streaming) ────────────────────────────────────────────────
async function chat(gameId, userId, messages) {
  const usage = await incrementUsage(userId);
  if (usage === null) {
    const err = new Error('Rate limit exceeded'); err.status = 429; throw err;
  }

  const cfg = await getConfig();
  let gameCtx = null;
  try { gameCtx = await getGameContext(gameId); } catch {}

  const systemPrompt = buildSystemPrompt(cfg, gameCtx?.game, gameCtx?.questions ?? []);
  const groq = await getGroq();
  const model = cfg.model || 'llama-3.3-70b-versatile';

  let msgs = [
    { role: 'system', content: systemPrompt },
    ...messages.slice(-10),
  ];

  let finalReply = '';
  const startAll = Date.now();

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const iterStart = Date.now();
    const tool_choice = i === 0 ? 'required' : 'auto';

    const completion = await groq.chat.completions.create({
      model,
      messages: msgs,
      tools: TOOL_SCHEMAS,
      tool_choice,
      max_tokens: parseInt(cfg.max_tokens) || 600,
      temperature: parseFloat(cfg.temperature) || 0.7,
    });

    const msg = completion.choices[0].message;
    const usage_data = completion.usage || {};

    await logEvent({
      user_id: userId,
      game_id: gameId ? parseInt(gameId) : null,
      event_type: 'llm_call',
      model,
      duration_ms: Date.now() - iterStart,
      prompt_tokens: usage_data.prompt_tokens,
      completion_tokens: usage_data.completion_tokens,
      total_tokens: usage_data.total_tokens,
    });

    // No tool calls → final answer
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      finalReply = (msg.content || '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/#{1,6}\s*/g, '').trim();
      break;
    }

    // Execute tool calls
    msgs.push({ role: 'assistant', tool_calls: msg.tool_calls, content: msg.content || '' });

    for (const tc of msg.tool_calls) {
      const toolStart = Date.now();
      let result;
      try {
        const fn = TOOL_FN_MAP[tc.function.name];
        if (!fn) throw new Error(`Unknown tool: ${tc.function.name}`);
        const args = JSON.parse(tc.function.arguments || '{}');
        result = await fn(args);

        await logEvent({
          user_id: userId,
          event_type: 'tool_call',
          tool_name: tc.function.name,
          tool_args: args,
          duration_ms: Date.now() - toolStart,
        });
      } catch (err) {
        result = { markdown: `שגיאה: ${err.message}`, rows: 0 };
        await logEvent({
          user_id: userId,
          event_type: 'error',
          tool_name: tc.function.name,
          error_message: err.message,
          duration_ms: Date.now() - toolStart,
        });
      }

      msgs.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: result.markdown,
      });
    }
  }

  if (!finalReply) {
    // Force synthesize if max iterations hit
    const completion = await groq.chat.completions.create({
      model,
      messages: [...msgs, { role: 'user', content: 'סכם את הניתוח בתשובה קצרה בעברית.' }],
      max_tokens: 400,
      temperature: parseFloat(cfg.temperature) || 0.7,
    });
    finalReply = (completion.choices[0].message.content || '').trim();
  }

  return { reply: finalReply, remaining: usage.limit - usage.count };
}

// ── SSE streaming version ─────────────────────────────────────────────────────
async function chatStream(gameId, userId, messages, onEvent, isPlayground = false) {
  if (!isPlayground) {
    const usage = await incrementUsage(userId);
    if (usage === null) {
      onEvent('error', { message: 'הגעת למגבלת השימוש היומית' });
      return;
    }
  }

  const cfg = await getConfig();
  let gameCtx = null;
  try { gameCtx = await getGameContext(gameId, isPlayground); } catch {}

  const systemPrompt = buildSystemPrompt(cfg, gameCtx?.game, gameCtx?.questions ?? []);
  const groq = await getGroq();
  const model = cfg.model || 'llama-3.3-70b-versatile';

  let msgs = [
    { role: 'system', content: systemPrompt },
    ...(messages || []).slice(-10),
  ];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const tool_choice = i === 0 ? 'required' : 'auto';
    onEvent('thinking', { step: i === 0 ? 'planning' : 'reflecting' });

    const completion = await groq.chat.completions.create({
      model,
      messages: msgs,
      tools: TOOL_SCHEMAS,
      tool_choice,
      max_tokens: parseInt(cfg.max_tokens) || 600,
      temperature: parseFloat(cfg.temperature) || 0.7,
    });

    const msg = completion.choices[0].message;
    await logEvent({
      user_id: userId,
      game_id: gameId ? parseInt(gameId) : null,
      event_type: 'llm_call',
      model,
      prompt_tokens: completion.usage?.prompt_tokens,
      completion_tokens: completion.usage?.completion_tokens,
      total_tokens: completion.usage?.total_tokens,
    });

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      const text = (msg.content || '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/#{1,6}\s*/g, '').trim();
      for (const char of text) onEvent('token', { delta: char });
      onEvent('done', { total_tokens: completion.usage?.total_tokens ?? 0 });
      return;
    }

    msgs.push({ role: 'assistant', tool_calls: msg.tool_calls, content: msg.content || '' });

    for (const tc of msg.tool_calls) {
      const args = JSON.parse(tc.function.arguments || '{}');
      onEvent('tool_call', { tool: tc.function.name, args });

      let result;
      try {
        const fn = TOOL_FN_MAP[tc.function.name];
        if (!fn) throw new Error(`Unknown tool: ${tc.function.name}`);
        result = await fn(args);
        await logEvent({ user_id: userId, event_type: 'tool_call', tool_name: tc.function.name, tool_args: args });
      } catch (err) {
        result = { markdown: `שגיאה: ${err.message}`, rows: 0 };
        await logEvent({ user_id: userId, event_type: 'error', tool_name: tc.function.name, error_message: err.message });
      }

      msgs.push({ role: 'tool', tool_call_id: tc.id, content: result.markdown });
    }
  }

  // Fallback synthesize
  onEvent('thinking', { step: 'synthesizing' });
  const final = await groq.chat.completions.create({
    model, messages: [...msgs, { role: 'user', content: 'סכם בתשובה קצרה בעברית.' }],
    max_tokens: 400, temperature: parseFloat(cfg.temperature) || 0.7,
  });
  const text = (final.choices[0].message.content || '').trim();
  for (const char of text) onEvent('token', { delta: char });
  onEvent('done', { total_tokens: final.usage?.total_tokens ?? 0 });
}

module.exports = { chat, chatStream };
