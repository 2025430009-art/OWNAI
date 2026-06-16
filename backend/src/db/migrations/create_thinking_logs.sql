-- OWNAI AI Thinking Engine logs
-- Requires: PostgreSQL with pgcrypto (gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS thinking_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  mode TEXT NOT NULL,
  detected_mode TEXT,
  prompt_sent TEXT,
  raw_response TEXT,
  parsed_result JSONB,
  confidence INTEGER,
  tokens_used INTEGER,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_thinking_logs_user_created
  ON thinking_logs(user_id, created_at DESC);
