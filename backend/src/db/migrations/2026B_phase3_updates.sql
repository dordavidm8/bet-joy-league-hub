-- Phase 3 Expansion Updates (A/B testing, Insights)

-- 1. Add A/B matching group ID to tie variants together
ALTER TABLE social_posts
ADD COLUMN IF NOT EXISTS ab_group_id UUID;

CREATE INDEX IF NOT EXISTS idx_social_posts_ab_group ON social_posts(ab_group_id);

-- 2. Add structured JSON insights tracking on competitor analysis
ALTER TABLE social_competitor_posts
ADD COLUMN IF NOT EXISTS insights_json JSONB;
