-- V2 Social Agents Foundation
-- Creates the decentralized skill orchestration tables

-- Bug #10 & #6: Append missing fields to old runs table safely
ALTER TABLE IF EXISTS social_pipeline_runs ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS social_pipeline_runs ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS social_pipeline_runs ADD COLUMN IF NOT EXISTS dry_run BOOLEAN DEFAULT false;
ALTER TABLE IF EXISTS social_pipeline_runs ADD COLUMN IF NOT EXISTS draft_count INTEGER DEFAULT 0;
ALTER TABLE IF EXISTS social_pipeline_runs ADD COLUMN IF NOT EXISTS warning TEXT;

CREATE TABLE IF NOT EXISTS agent_roster (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_name VARCHAR(100) UNIQUE NOT NULL,
  role VARCHAR(50),
  title VARCHAR(100),
  avatar VARCHAR(10),
  enabled BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES social_pipeline_runs(id) ON DELETE CASCADE,
  skill_name VARCHAR(100) REFERENCES agent_roster(skill_name),
  stage VARCHAR(50),
  status VARCHAR(20),         -- queued | running | success | failed
  input JSONB,
  output JSONB,
  error TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS agent_events (
  id BIGSERIAL PRIMARY KEY,
  run_id UUID REFERENCES social_pipeline_runs(id) ON DELETE CASCADE,
  skill_name VARCHAR(100),
  event_type VARCHAR(50),     -- stage_started | stage_completed | stage_failed | log | tool_call
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_run ON agent_tasks(run_id);
CREATE INDEX IF NOT EXISTS idx_agent_events_run ON agent_events(run_id);

-- Seed roster
INSERT INTO agent_roster (skill_name, role, title, avatar) VALUES
  ('research-agent', 'Research', 'סוכן מחקר', '🔍'),
  ('strategy-agent', 'Strategy', 'סוכן אסטרטגיה', '🧠'),
  ('creative-content-agent', 'Content', 'סוכן תוכן וקריאייטיב', '✍️'),
  ('seo-geo-agent', 'SEO', 'סוכן SEO/GEO', '📈'),
  ('social-media-agent', 'Social', 'סוכן רשתות חברתיות', '📱'),
  ('competitor-agent', 'Competitor', 'סוכן ניתוח מתחרים', '🎯'),
  ('outreach-agent', 'Outreach', 'סוכן Outreach', '🤝'),
  ('draft-packager', 'Publisher', 'אורז טיוטות', '📦'),
  ('remotion-video-agent', 'Video', 'מפיק וידאו', '🎬'),
  ('nano-banana-agent', 'ImagePrompt', 'מעצב חזותי', '🍌'),
  ('notebooklm-agent', 'VideoAudio', 'מפיק פודקאסטים', '📓')
ON CONFLICT (skill_name) DO NOTHING;
