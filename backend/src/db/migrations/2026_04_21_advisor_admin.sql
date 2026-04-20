-- advisor_events: logs every LLM call, tool call, and error
CREATE TABLE IF NOT EXISTS advisor_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT,
  thread_id       TEXT,
  game_id         INT,
  event_type      TEXT NOT NULL, -- 'llm_call' | 'tool_call' | 'error'
  tool_name       TEXT,
  tool_args       JSONB,
  tool_cached     BOOLEAN,
  duration_ms     INT,
  prompt_tokens   INT,
  completion_tokens INT,
  total_tokens    INT,
  model           TEXT,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_advisor_events_created_at ON advisor_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_advisor_events_user_id    ON advisor_events (user_id);
CREATE INDEX IF NOT EXISTS idx_advisor_events_event_type ON advisor_events (event_type);

-- advisor_config: key/value settings managed by admin
CREATE TABLE IF NOT EXISTS advisor_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
);

INSERT INTO advisor_config (key, value) VALUES
  ('model',         'llama-3.3-70b-versatile'),
  ('daily_limit',   '20'),
  ('temperature',   '0.7'),
  ('max_tokens',    '600'),
  ('system_prompt', 'אתה יועץ הימורי של Kickoff. ענה תמיד בעברית, בטון חברותי וקצר. אל תמציא סטטיסטיקות.')
ON CONFLICT (key) DO NOTHING;

-- encrypted_secrets: AES-256-GCM encrypted API keys
CREATE TABLE IF NOT EXISTS encrypted_secrets (
  key             TEXT PRIMARY KEY,
  value_encrypted BYTEA NOT NULL,
  iv              BYTEA NOT NULL,
  auth_tag        BYTEA NOT NULL,
  preview         TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by      TEXT
);
