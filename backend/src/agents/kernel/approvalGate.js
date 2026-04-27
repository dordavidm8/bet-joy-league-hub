const { agentsPool: pool } = require('../../config/database');
const { initPipelineRun, runSkill } = require('./orchestrator');

/**
 * ApprovalGate (Phase 2-7)
 * Manages human-in-the-loop approvals for sensitive agent actions.
 */
const ApprovalGate = {
  /**
   * List pending approvals for a company
   */
  async listPending(companyId) {
    const res = await pool.query(
      `SELECT a.*, i.title as issue_title, i.body as issue_body, i.assigned_skill
       FROM agent_approvals a
       JOIN agent_issues i ON a.issue_id = i.id
       WHERE i.company_id = $1 AND a.status = 'pending'
       ORDER BY a.created_at ASC`,
      [companyId]
    );
    return res.rows;
  },

  /**
   * Request a new approval (Phase 7)
   */
  async requestApproval({ issueId, requestType, payload, requestedBy }) {
    await pool.query(
      `INSERT INTO agent_approvals (issue_id, request_type, payload, requested_by) 
       VALUES ($1, $2, $3, $4)`,
      [issueId, requestType, JSON.stringify(payload), requestedBy]
    );
    console.log(`🙋 [ApprovalGate] Approval requested: ${requestType} by ${requestedBy}`);
  },

  /**
   * Decide on an approval request
   */
  async decide(approvalId, { decision, comment = '', userId = 'admin' }) {
    const { executeTool } = require('../tools/toolRegistry');
    const TicketManager = require('./ticketManager');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const res = await client.query('SELECT * FROM agent_approvals WHERE id = $1 FOR UPDATE', [approvalId]);
      const app = res.rows[0];
      if (!app) throw new Error('Approval request not found');
      if (app.status !== 'pending') throw new Error('Request already decided');

      await client.query(
        `UPDATE agent_approvals SET status = $1, comment = $2, decided_by = $3, decided_at = NOW() WHERE id = $4`,
        [decision, comment, userId, approvalId]
      );

      const payload = typeof app.payload === 'string' ? JSON.parse(app.payload) : app.payload;

      if (decision === 'approved') {
        if (app.request_type === 'hire_agent') {
          const issueRes = await client.query('SELECT company_id, title, body FROM agent_issues WHERE id = $1', [app.issue_id]);
          const issue = issueRes.rows[0];
          
          const { runId } = await initPipelineRun({ companyId: issue.company_id });
          runSkill(runId, payload.targetSkill, { 
            issueId: app.issue_id, 
            input: { taskDescription: payload.taskDescription, parentTitle: issue.title } 
          }).catch(err => console.error('[ApprovalGate] HireAgent failed:', err.message));
        } 
        
        else if (app.request_type === 'video_text_review') {
          console.log(`🎬 [ApprovalGate] Text approved! Rendering video for job ${payload.jobId}...`);
          
          // Fix renderParams structure (Point #3)
          const renderParams = {
            inputProps: payload.inputProps,
            compositionId: payload.compositionId,
            runId: payload.runId,
            jobId: payload.jobId
          };

          executeTool('remotionRenderer', renderParams).then(async (result) => {
            // Task Closing (Point #7): Set agent_tasks to success
            await pool.query(
              `UPDATE agent_tasks SET status = 'success', finished_at = NOW() 
               WHERE run_id = $1 AND skill_name = $2 AND status = 'awaiting_approval'`,
              [payload.runId, app.requested_by]
            );

            // After render success, request next schedule approval
            await this.requestApproval({
              issueId: app.issue_id,
              requestType: 'schedule_next_video',
              requestedBy: 'system',
              payload: { mediaUrl: result.url, runId: payload.runId }
            });
          }).catch(err => console.error('[ApprovalGate] Render failed:', err.message));
        }

        else if (app.request_type === 'schedule_next_video') {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(9, 0, 0, 0);
          
          await client.query(
            `INSERT INTO agent_issues (company_id, title, body, assigned_skill, status, scheduled_for, created_by)
             SELECT company_id, title, body, assigned_skill, 'scheduled', $1, 'system_loop'
             FROM agent_issues WHERE id = $2`,
            [tomorrow, app.issue_id]
          );
          console.log(`📅 [ApprovalGate] Next video scheduled for ${tomorrow.toISOString()}`);
        }
      } 
      
      else { // REJECTED / DENIED
        if (app.request_type === 'video_text_review') {
          console.log(`🔄 [ApprovalGate] Video text rejected. Re-running agent with feedback...`);
          const issueRes = await client.query('SELECT * FROM agent_issues WHERE id = $1', [app.issue_id]);
          const issue = issueRes.rows[0];
          
          const { runId } = await initPipelineRun({ companyId: issue.company_id });
          runSkill(runId, issue.assigned_skill, { 
            issueId: app.issue_id, 
            input: { 
              originalProps: payload.inputProps, 
              feedback: comment,
              isRetry: true
            } 
          }).catch(err => console.error('[ApprovalGate] Retry failed:', err.message));
        } else {
          await client.query(`UPDATE agent_issues SET status = 'rejected' WHERE id = $1`, [app.issue_id]);
        }
      }

      await client.query('COMMIT');
      return { success: true, decision };
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('ApprovalGate Decide Error:', err.message);
      throw err;
    } finally {
      client.release();
    }
  }
};

module.exports = ApprovalGate;
