-- PromptToVideo AI job history (OWNAI PostgreSQL store)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS prompt_to_video_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  progress INTEGER DEFAULT 0,
  current_step TEXT,
  title TEXT,
  mood TEXT,
  script JSONB,
  scene_images JSONB DEFAULT '[]'::jsonb,
  output_path TEXT,
  share_token TEXT UNIQUE,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ptv_jobs_user_created
  ON prompt_to_video_jobs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ptv_jobs_share_token
  ON prompt_to_video_jobs(share_token);
