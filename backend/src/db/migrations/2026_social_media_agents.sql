-- Social Media Agents — Database Migration
-- Run: psql $DATABASE_URL < backend/src/db/migrations/2026_social_media_agents.sql

-- ── Agent configuration ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_agent_config (
  key         VARCHAR(100) PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  VARCHAR(255)
);

-- Seed defaults
INSERT INTO social_agent_config (key, value) VALUES
  ('enabled', 'false'),
  ('auto_approve', 'false'),
  ('posting_time', '08:00'),
  ('timezone', 'Asia/Jerusalem'),
  ('linkedin_enabled', 'true'),
  ('instagram_enabled', 'true'),
  ('tiktok_enabled', 'true'),
  ('brand_voice', 'חברותי, מקצועי, עם הומור קליל. מדבר בגובה העיניים עם קהל ישראלי צעיר שאוהב כדורגל.'),
  ('content_style', 'engaging, data-driven, community-focused'),
  ('daily_limit', '3'),
  ('model', 'llama-3.3-70b-versatile')
ON CONFLICT (key) DO NOTHING;

-- ── Posts ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_posts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_run_id   UUID,
  platform          VARCHAR(20) NOT NULL CHECK (platform IN ('linkedin', 'instagram', 'tiktok')),
  caption           TEXT,
  final_caption     TEXT,
  hashtags          TEXT[],
  media_type        VARCHAR(20) DEFAULT 'image' CHECK (media_type IN ('image', 'video', 'carousel', 'text')),
  image_prompt      TEXT,
  image_url         TEXT,
  image_base64      TEXT,
  video_prompt      TEXT,
  video_url         TEXT,
  geo_content       JSONB,
  hook_he           TEXT,
  hook_en           TEXT,
  overlay_lines     TEXT[],
  cta               TEXT,
  script            TEXT,
  status            VARCHAR(30) NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'published', 'failed')),
  published_at      TIMESTAMPTZ,
  published_id      TEXT,
  rejection_reason  TEXT,
  approved_by       VARCHAR(255),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(status);
CREATE INDEX IF NOT EXISTS idx_social_posts_platform ON social_posts(platform);
CREATE INDEX IF NOT EXISTS idx_social_posts_created ON social_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_posts_run ON social_posts(pipeline_run_id);

-- ── Pipeline runs ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_pipeline_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date        DATE NOT NULL,
  status          VARCHAR(30) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  triggered_by    VARCHAR(50) NOT NULL DEFAULT 'cron',
  triggered_email VARCHAR(255),
  dry_run         BOOLEAN NOT NULL DEFAULT false,
  weekly_theme    JSONB,
  content_angle   JSONB,
  agent_log       JSONB,
  errors          JSONB,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_social_runs_date ON social_pipeline_runs(run_date);
CREATE INDEX IF NOT EXISTS idx_social_runs_status ON social_pipeline_runs(status);

-- ── Content calendar ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_content_calendar (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start  DATE NOT NULL,
  theme       TEXT NOT NULL,
  theme_he    TEXT,
  sub_topics  JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(week_start)
);

CREATE INDEX IF NOT EXISTS idx_social_calendar_week ON social_content_calendar(week_start);

-- ── Post analytics ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_post_analytics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id         UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  impressions     INTEGER DEFAULT 0,
  reach           INTEGER DEFAULT 0,
  likes           INTEGER DEFAULT 0,
  comments        INTEGER DEFAULT 0,
  shares          INTEGER DEFAULT 0,
  saves           INTEGER DEFAULT 0,
  clicks          INTEGER DEFAULT 0,
  engagement_rate DECIMAL(6,4) DEFAULT 0,
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_analytics_post ON social_post_analytics(post_id);

-- ── Knowledge base ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_knowledge_base (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       VARCHAR(200) NOT NULL,
  content     TEXT NOT NULL,
  category    VARCHAR(50) NOT NULL DEFAULT 'general',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed brand knowledge
INSERT INTO social_knowledge_base (title, content, category) VALUES
  ('מהי DerbyUp', 'DerbyUp היא פלטפורמת הימורי כדורגל חברתית בעברית. משתמשים מהמרים עם נקודות (לא כסף אמיתי) על משחקי כדורגל, מתחרים בליגות פרטיות עם חברים, ומשתמשים ביועץ AI חכם. האפליקציה כוללת מיני-משחקים יומיים, טריוויה, ובוט WhatsApp.', 'brand'),
  ('קהל יעד', 'גברים ונשים בגילאי 18-35 בישראל שאוהבים כדורגל. הקהל מבין ספורט, פעיל ברשתות חברתיות, ומחפש חוויה חברתית מהנה סביב משחקי כדורגל.', 'brand'),
  ('טון דיבור', 'חברותי ומקצועי. מדברים בגובה העיניים, עם הומור קליל, ושימוש באימוג''ים. לא מנסים להיות יותר מדי רשמיים. תמיד כוללים CTA ברור.', 'brand'),
  ('תכונות עיקריות', 'הימורים חכמים עם יועץ AI, ליגות פרטיות עם חברים, מיני-משחקים יומיים (Box2Box, MissingXI, WhoAreYa, GuessClub), טריוויית כדורגל, ובוט WhatsApp לניהול ליגות.', 'features')
ON CONFLICT DO NOTHING;

-- ── Unified memory ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_unified_memory (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_type VARCHAR(50) NOT NULL CHECK (memory_type IN ('insight', 'performance', 'audience', 'trend', 'lesson')),
  content     TEXT NOT NULL,
  importance  INTEGER NOT NULL DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),
  source      VARCHAR(100),
  expires_at  DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_memory_type ON social_unified_memory(memory_type);
CREATE INDEX IF NOT EXISTS idx_social_memory_importance ON social_unified_memory(importance DESC);

-- ── Competitor posts ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_competitor_posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_name VARCHAR(200) NOT NULL,
  platform        VARCHAR(20) NOT NULL,
  url             TEXT,
  snippet         TEXT,
  engagement_est  INTEGER DEFAULT 0,
  analysis        TEXT,
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_competitors_fetched ON social_competitor_posts(fetched_at DESC);

-- ── Social mentions ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_mentions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source      VARCHAR(200),
  platform    VARCHAR(50),
  url         TEXT,
  snippet     TEXT,
  sentiment   VARCHAR(20) CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  is_pr_risk  BOOLEAN NOT NULL DEFAULT false,
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_mentions_risk ON social_mentions(is_pr_risk) WHERE is_pr_risk = true;
CREATE INDEX IF NOT EXISTS idx_social_mentions_analyzed ON social_mentions(analyzed_at DESC);

-- ── Chat history ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_chat_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email  VARCHAR(255) NOT NULL,
  role        VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL,
  tools_used  JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_chat_user ON social_chat_history(user_email, created_at DESC);
