-- 2026D_paperclip_phase.sql
-- Phase 4: Knowledge Economy & Memory Infrastructure

-- 1. Agent Memories Table (Long-term Context)
CREATE TABLE IF NOT EXISTS agent_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES social_pipeline_runs(id),
    skill_name VARCHAR(100),
    entity_key VARCHAR(255), -- e.g., 'maccabi_form' or 'competitor_x_style'
    memory_type VARCHAR(50) DEFAULT 'fact', -- fact, preference, insight
    content TEXT NOT NULL,
    importance_score INTEGER DEFAULT 5, -- 1-10
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- 2. Knowledge Assets (RAG Sources)
CREATE TABLE IF NOT EXISTS knowledge_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    asset_type VARCHAR(50) NOT NULL, -- pdf, csv, text, url
    storage_path TEXT, -- Internal path or local reference
    raw_content TEXT, -- For smaller documents
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Social Interaction Logs (For Feedback Loop)
CREATE TABLE IF NOT EXISTS social_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES social_posts(id),
    platform VARCHAR(50),
    interaction_type VARCHAR(50), -- like, comment, reshare
    sentiment_score NUMERIC(3,2), -- -1.0 to 1.0
    raw_payload JSONB,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Budget & Quota Tracking
ALTER TABLE social_pipeline_runs ADD COLUMN IF NOT EXISTS total_tokens_used INTEGER DEFAULT 0;
ALTER TABLE social_pipeline_runs ADD COLUMN IF NOT EXISTS estimated_cost_usd NUMERIC(10,5) DEFAULT 0.0;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_memories_entity ON agent_memories(entity_key);
CREATE INDEX IF NOT EXISTS idx_knowledge_type ON knowledge_assets(asset_type);

-- Seed initial knowledge structure
INSERT INTO knowledge_assets (title, asset_type, metadata) VALUES 
('Brand Guidelines 2026', 'brand_book', '{"primary_color": "#4CAF50", "tone": "Friendly expert"}'),
('Competitor Analysis Q1', 'market_research', '{"focus": "Sports betting apps in Israel"}')
ON CONFLICT DO NOTHING;
