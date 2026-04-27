const { agentsPool: pool } = require('../../config/database');

/**
 * KnowledgeManager
 * Handles Agent Memories (Long-term context) and Knowledge Assets (RAG facts).
 */
const KnowledgeManager = {
  /**
   * Store a new memory for an agent
   */
  async remember(runId, skillName, key, content, type = 'fact', importance = 5) {
    try {
      const query = `
        INSERT INTO agent_memories (run_id, skill_name, entity_key, content, memory_type, importance_score)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `;
      const res = await pool.query(query, [runId, skillName, key, content, type, importance]);
      return res.rows[0].id;
    } catch (err) {
      console.error('KnowledgeManager Error (remember):', err.message);
      return null;
    }
  },

  /**
   * Retrieve relevant memories based on key or skill
   */
  async searchMemories(key, limit = 5) {
    try {
      const query = `
        SELECT * FROM agent_memories 
        WHERE entity_key ILIKE $1 
        ORDER BY importance_score DESC, created_at DESC 
        LIMIT $2
      `;
      const res = await pool.query(query, [`%${key}%`, limit]);
      return res.rows;
    } catch (err) {
      console.error('KnowledgeManager Error (searchMemories):', err.message);
      return [];
    }
  },

  /**
   * Get all active knowledge assets (Brand book, research, etc)
   */
  async getActiveAssets() {
    try {
      const res = await pool.query(`SELECT * FROM knowledge_assets WHERE is_active = true`);
      return res.rows;
    } catch (err) {
      console.error('KnowledgeManager Error (getActiveAssets):', err.message);
      return [];
    }
  },

  /**
   * Logs a social interaction (feedback loop)
   */
  async logInteraction(postId, platform, type, payload) {
    try {
      const query = `
        INSERT INTO social_interactions (post_id, platform, interaction_type, raw_payload)
        VALUES ($1, $2, $3, $4)
      `;
      await pool.query(query, [postId, platform, type, JSON.stringify(payload)]);
    } catch (err) {
      console.error('KnowledgeManager Error (logInteraction):', err.message);
    }
  }
};

module.exports = KnowledgeManager;
