-- 2026E_media_tools.sql
-- Phase 5: Media Production Infrastructure (Remotion & NotebookLM)

-- 1. Support Media Fields in Posts
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS media_type VARCHAR(20); -- image | video | audio | pdf
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS media_thumbnail_url TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS media_metadata JSONB DEFAULT '{}';

-- 2. Media Jobs Tracking (Async production)
CREATE TABLE IF NOT EXISTS media_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES social_pipeline_runs(id) ON DELETE CASCADE,
    post_id UUID REFERENCES social_posts(id) ON DELETE CASCADE,
    tool_name VARCHAR(50) NOT NULL, -- remotion | notebooklm
    status VARCHAR(20) DEFAULT 'queued', -- queued | rendering | success | failed
    input_params JSONB DEFAULT '{}',
    output_url TEXT,
    error_log TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Storage Reference Registry
CREATE TABLE IF NOT EXISTS media_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name TEXT NOT NULL,
    file_type VARCHAR(50), -- video/mp4 | audio/mpeg
    local_path TEXT,
    public_url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_media_jobs_run ON media_jobs(run_id);
CREATE INDEX IF NOT EXISTS idx_media_jobs_status ON media_jobs(status);
