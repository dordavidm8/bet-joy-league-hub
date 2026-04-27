const { agentsPool: pool } = require('../../config/database');
const TicketManager = require('../kernel/ticketManager');

/**
 * HireAgent Tool (Stage D)
 * Allows an agent to delegate a task to another agent by creating a child issue.
 * Supports an optional approval flow.
 */
async function hireAgent(args, context = {}) {
  const { targetSkill, taskDescription, priority = 'normal', requiresApproval = true } = args;
  const { issueId, companyId, runId } = context;

  if (!targetSkill || !taskDescription) {
    throw new Error('hireAgent: Missing targetSkill or taskDescription');
  }

  console.log(`🤝 [HireAgent] Agent ${context.skillName} is hiring ${targetSkill} for: ${taskDescription}`);

  // 1. Create the Child Issue
  const childIssue = await TicketManager.createIssue({
    company_id: companyId,
    title: `Delegated Task: ${targetSkill}`,
    body: taskDescription,
    assigned_skill: targetSkill,
    priority: priority,
    parent_issue_id: issueId, // Link to parent
    created_by: `agent:${context.skillName}`
  });

  // 2. If approval is required, create an approval request instead of running immediately
  if (requiresApproval) {
    await pool.query(
      `INSERT INTO agent_approvals (issue_id, request_type, payload, requested_by) 
       VALUES ($1, $2, $3, $4)`,
      [childIssue.id, 'hire_agent', JSON.stringify({ targetSkill, taskDescription, runId }), context.skillName]
    );

    return {
      success: true,
      message: `Hire request for ${targetSkill} submitted for approval.`,
      issueId: childIssue.id,
      status: 'waiting_for_approval'
    };
  }

  // 3. (Optional) Run automatically if no approval needed (usually we want approval for budget reasons)
  return {
    success: true,
    message: `Agent ${targetSkill} has been hired and issue ${childIssue.id} created.`,
    issueId: childIssue.id,
    status: 'created'
  };
}

module.exports = hireAgent;
