-- Research paper management system (OWNAI)
-- Requires: PostgreSQL with pgcrypto (gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS research_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  research_question TEXT,
  target_journal TEXT,
  domain TEXT, -- 'vlsi', 'approximate_computing', 'video_coding', 'neural_nets', 'fuzzy_logic', 'dsp', 'fpga', 'survey'
  phase INTEGER DEFAULT 0, -- 0-7 (8 phases)
  status TEXT DEFAULT 'active', -- 'active', 'submitted', 'revision', 'accepted', 'published'
  success_criteria JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS research_papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES research_projects(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  authors TEXT[],
  journal TEXT,
  year INTEGER,
  doi TEXT,
  citations INTEGER DEFAULT 0,
  key_contribution TEXT,
  limitation_gap TEXT,
  category TEXT, -- 'adder', 'multiplier', 'transform', 'codec', 'nn_hw', 'fuzzy', 'survey'
  metrics JSONB DEFAULT '{}', -- stores PE, ME, MSE, gate_count, etc.
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gap_matrix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES research_projects(id) ON DELETE CASCADE,
  paper_id UUID REFERENCES research_papers(id) ON DELETE CASCADE,
  dimension TEXT NOT NULL, -- column name (metric/method/application)
  value TEXT,
  is_gap BOOLEAN DEFAULT false,
  gap_score FLOAT -- novelty × importance / difficulty
);

CREATE TABLE IF NOT EXISTS math_derivations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES research_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- 'PE_LOA', 'ME_LOA', 'MSE_LOA', etc.
  theorem_statement TEXT,
  proof_steps JSONB DEFAULT '[]', -- array of step strings
  formula_latex TEXT,
  validated BOOLEAN DEFAULT false,
  validation_error_percent FLOAT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS simulation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES research_projects(id) ON DELETE CASCADE,
  tool TEXT NOT NULL, -- 'matlab', 'python', 'verilog'
  parameters JSONB DEFAULT '{}', -- nLPL, HBL, VBL, WL etc.
  results JSONB DEFAULT '{}', -- PE, ME, MSE, BD_rate, ADP_savings
  status TEXT DEFAULT 'pending', -- 'pending', 'running', 'done', 'failed'
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS paper_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES research_projects(id) ON DELETE CASCADE,
  phase_number INTEGER NOT NULL, -- 0-7
  phase_name TEXT NOT NULL,
  outputs JSONB DEFAULT '[]',
  completed BOOLEAN DEFAULT false,
  notes TEXT,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_research_projects_user_id ON research_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_research_papers_project_id ON research_papers(project_id);
CREATE INDEX IF NOT EXISTS idx_simulation_runs_project_id ON simulation_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_gap_matrix_project_id ON gap_matrix(project_id);
CREATE INDEX IF NOT EXISTS idx_math_derivations_project_id ON math_derivations(project_id);
CREATE INDEX IF NOT EXISTS idx_paper_phases_project_id ON paper_phases(project_id);
