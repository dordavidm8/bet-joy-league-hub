-- 2026F_mission_control.sql
-- Stages A, B, C & D: Multi-tenancy, Issues, Heartbeat and Approvals

-- 1. Multi-Tenancy (Stage A)
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    owner_user_id VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed KickOff
INSERT INTO companies (id, name) 
VALUES ('00000000-0000-0000-0000-000000000000', 'KickOff Agency')
ON CONFLICT DO NOTHING;

-- 2. Agent Roster Updates (Stage A/C)
ALTER TABLE agent_roster ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE agent_roster ADD COLUMN IF NOT EXISTS heartbeat_cron TEXT;
ALTER TABLE agent_roster ADD COLUMN IF NOT EXISTS heartbeat_enabled BOOLEAN DEFAULT false;
ALTER TABLE agent_roster ADD COLUMN IF NOT EXISTS soul TEXT;
ALTER TABLE agent_roster ADD COLUMN IF NOT EXISTS is_running BOOLEAN DEFAULT false;
ALTER TABLE agent_roster ADD COLUMN IF NOT EXISTS budget_tokens_daily INTEGER DEFAULT 100000;

-- 3. Agent Issues / Tickets (Stage B)
CREATE TABLE IF NOT EXISTS agent_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id),
    title VARCHAR(255) NOT NULL,
    body TEXT,
    assigned_skill VARCHAR(100),
    status VARCHAR(50) DEFAULT 'open', -- open, in_progress, done, failed, rejected
    priority VARCHAR(50) DEFAULT 'normal',
    parent_issue_id UUID REFERENCES agent_issues(id),
    createdBy VARCHAR(100) DEFAULT 'user',
    result JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Approval Gate (Stage D Prep)
CREATE TABLE IF NOT EXISTS agent_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID REFERENCES agent_issues(id),
    request_type VARCHAR(100), -- post_publish, hire_agent, budget_increase
    payload JSONB,
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, denied
    requested_by VARCHAR(100),
    decided_by VARCHAR(100),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    decided_at TIMESTAMP WITH TIME ZONE
);
