-- OWNAI persistent memory and knowledge graph
-- Requires: PostgreSQL with pgcrypto (gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  source_message TEXT,
  confidence FLOAT DEFAULT 0.8,
  access_count INTEGER DEFAULT 0,
  last_accessed TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  tags TEXT[] DEFAULT '{}',
  embedding_key TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT memories_type_check CHECK (
    type IN ('fact', 'preference', 'skill', 'project', 'relationship')
  )
);

CREATE TABLE IF NOT EXISTS knowledge_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  from_memory_id UUID REFERENCES memories(id) ON DELETE CASCADE,
  to_memory_id UUID REFERENCES memories(id) ON DELETE CASCADE,
  relation TEXT NOT NULL,
  strength FLOAT DEFAULT 0.5,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT knowledge_edges_relation_check CHECK (
    relation IN ('related_to', 'part_of', 'causes', 'contradicts', 'supports')
  )
);

CREATE INDEX IF NOT EXISTS idx_memories_user_type ON memories(user_id, type);
CREATE INDEX IF NOT EXISTS idx_memories_user_permanent ON memories(user_id) WHERE expires_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_user_from ON knowledge_edges(user_id, from_memory_id);
