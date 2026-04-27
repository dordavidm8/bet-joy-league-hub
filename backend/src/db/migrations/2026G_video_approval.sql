-- 2026G_video_approval.sql
-- Add scheduling support for issues/agent tickets

ALTER TABLE agent_issues
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP WITH TIME ZONE;

-- Index for efficient lookup of scheduled tasks
CREATE INDEX IF NOT EXISTS idx_issues_scheduled ON agent_issues(scheduled_for) WHERE status='scheduled';

-- Note: agent_approvals table already exists from previous phases
