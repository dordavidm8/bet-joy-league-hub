const { agentsPool: pool } = require('../../config/database');

/**
 * TicketManager (Phase 2-7)
 * Manages the lifecycle of agent issues/tickets.
 */
const TicketManager = {
  /**
   * Create a new issue for an agent
   */
  async createIssue(params) {
    const { 
      title, 
      body, 
      assigned_skill, assignedSkill,
      company_id, companyId,
      priority = 'normal', 
      created_by, createdBy = 'system',
      parent_issue_id, parentIssueId
    } = params;

    const skill = assigned_skill || assignedSkill;
    const cid = company_id || companyId;
    const creator = created_by || createdBy;
    const pid = parent_issue_id || parentIssueId || null;

    try {
      const res = await pool.query(
        `INSERT INTO agent_issues (title, body, assigned_skill, company_id, priority, created_by, status, parent_issue_id)
         VALUES ($1, $2, $3, $4, $5, $6, 'open', $7)
         RETURNING *`,
        [title, body, skill, cid, priority, creator, pid]
      );
      return res.rows[0];
    } catch (err) {
      console.error('TicketManager Error (createIssue):', err.message);
      throw err;
    }
  },

  /**
   * Update issue status/result
   */
  async updateIssue(id, { status, result }) {
    try {
      await pool.query(
        `UPDATE agent_issues 
         SET status = $1, result = $2, finished_at = CASE WHEN $1 IN ('done', 'failed', 'rejected') THEN NOW() ELSE finished_at END
         WHERE id = $3`,
        [status, JSON.stringify(result), id]
      );
    } catch (err) {
      console.error('TicketManager Error (updateIssue):', err.message);
      throw err;
    }
  },

  /**
   * Fetch issue details
   */
  async getIssue(issueId) {
    try {
      const res = await pool.query(`SELECT * FROM agent_issues WHERE id = $1`, [issueId]);
      return res.rows[0];
    } catch (err) {
      console.error('TicketManager Error (getIssue):', err.message);
      throw err;
    }
  },

  /**
   * Fetch issue scheduled for today (Phase 7)
   * Timezone aware: Checks if scheduled_for falls within today in Asia/Jerusalem.
   */
  async getScheduledForToday() {
    try {
      const res = await pool.query(
        `SELECT * FROM agent_issues 
         WHERE (scheduled_for AT TIME ZONE 'Asia/Jerusalem')::date = (NOW() AT TIME ZONE 'Asia/Jerusalem')::date
           AND status = 'scheduled'
         LIMIT 1`
      );
      return res.rows[0] || null;
    } catch (err) {
      console.error('TicketManager Error (getScheduledForToday):', err.message);
      return null;
    }
  }
};

module.exports = TicketManager;
