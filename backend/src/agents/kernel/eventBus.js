const EventEmitter = require('events');
const { agentsPool: pool } = require('../../config/database');

/**
 * EventBus singleton for the Agents V2 Kernel.
 * Exposes a standard Node.js EventEmitter that orchestrator,
 * taskRunner, and SSE endpoints can subscribe to.
 */
class AgentEventBus extends EventEmitter {}

const eventBus = new AgentEventBus();
eventBus.setMaxListeners(20);

// Bug #2: Sink events to agent_events table
const logToDb = async (event, data) => {
  if (!data || !data.runId) return;
  try {
    const agentName = data.skillName || data.agent || 'system';
    await pool.query(
      `INSERT INTO agent_events (run_id, skill_name, event_type, payload) VALUES ($1, $2, $3, $4)`,
      [data.runId, agentName, event, data]
    );
  } catch (err) {
    console.error('Failed to log event to DB:', err);
  }
};

eventBus.on('stage_started', (data) => logToDb('stage_started', data));
eventBus.on('stage_completed', (data) => logToDb('stage_completed', data));
eventBus.on('stage_failed', (data) => logToDb('stage_failed', data));

module.exports = eventBus;
