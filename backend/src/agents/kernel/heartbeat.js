const cron = require('node-cron');
const { agentsPool: pool } = require('../../config/database');
const TicketManager = require('./ticketManager');
const { initPipelineRun, runSkill } = require('./orchestrator');

/**
 * Heartbeat Kernel
 * Responsible for autonomous agent execution based on individual cron schedules.
 */
const Heartbeat = {
  activeJobs: {},

  /**
   * Start the heartbeat engine: scan roster and schedule jobs
   */
  async start() {
    console.log('💓 Heartbeat: Starting autonomous agent monitor...');
    await this.refreshSchedules();
    
    // Periodically refresh schedules (every hour) to pick up DB changes
    cron.schedule('0 * * * *', () => {
      this.refreshSchedules();
    });
  },

  /**
   * Scan database for enabled heartbeats and schedule node-cron tasks
   */
  async refreshSchedules() {
    try {
      const res = await pool.query(`
        SELECT skill_name, heartbeat_cron, heartbeat_enabled, soul, company_id, is_running 
        FROM agent_roster 
        WHERE heartbeat_enabled = true AND heartbeat_cron IS NOT NULL
      `);

      const enabledAgents = res.rows;
      console.log(`💓 Heartbeat: Found ${enabledAgents.length} agents with active schedules.`);

      // 1. Clear existing jobs that are no longer enabled or have changed
      for (const skillName in this.activeJobs) {
        const stillEnabled = enabledAgents.find(a => a.skill_name === skillName);
        if (!stillEnabled) {
          console.log(`💓 Heartbeat: Stopping job for ${skillName}`);
          this.activeJobs[skillName].stop();
          delete this.activeJobs[skillName];
        }
      }

      // 2. Schedule new or updated jobs
      for (const agent of enabledAgents) {
        // If already running with same cron, skip
        if (this.activeJobs[agent.skill_name]) continue;

        console.log(`💓 Heartbeat: Scheduling ${agent.skill_name} at [${agent.heartbeat_cron}]`);
        
        const job = cron.schedule(agent.heartbeat_cron, async () => {
          await this.executeAutonomousTask(agent);
        });
        
        this.activeJobs[agent.skill_name] = job;
      }
    } catch (err) {
      console.error('💓 Heartbeat Refresh Error:', err.message);
    }
  },

  /**
   * The actual execution loop for an autonomous agent
   */
  async executeAutonomousTask(agent) {
    const { skill_name, soul, company_id } = agent;
    
    // Double check is_running from DB to prevent overlaps across processes
    const checkRes = await pool.query('SELECT is_running FROM agent_roster WHERE skill_name = $1', [skill_name]);
    if (checkRes.rows[0]?.is_running) {
      console.log(`💓 Heartbeat: ${skill_name} is already running, skipping this beat.`);
      return;
    }

    console.log(`💓 Heartbeat: ${skill_name} waking up for autonomous mission...`);

    try {
      // 1. Create an autonomous issue
      const issue = await TicketManager.createIssue({
        company_id: company_id,
        title: `אוטונומי: ${skill_name} - ריצה מתוזמנת`,
        body: soul || 'בצע את המשימה השגרתית שלך על בסיס הידע הקיים במערכת.',
        assigned_skill: skill_name,
        created_by: 'system'
      });

      // 2. Initialize pipeline run
      const { runId } = await initPipelineRun({ companyId: company_id });

      // 3. Execute
      await runSkill(runId, skill_name, { 
        issueId: issue.id, 
        input: { 
          reason: 'heartbeat_trigger',
          soul: soul 
        } 
      });

      console.log(`💓 Heartbeat: ${skill_name} mission completed successfully.`);
    } catch (err) {
      console.error(`💓 Heartbeat execution failed for ${skill_name}:`, err.message);
    }
  }
};

module.exports = Heartbeat;
