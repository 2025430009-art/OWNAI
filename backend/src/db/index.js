import pg from 'pg';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

let pool = null;
let dbAvailable = false;

export function isDatabaseAvailable() {
  return dbAvailable;
}

export function getPool() {
  if (!pool) {
    pool = new Pool({ connectionString: config.database.url });
    pool.on('error', (err) => logger.error('PostgreSQL pool error', { error: err.message }));
  }
  return pool;
}

export async function initDatabase() {
  const client = await getPool().connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS usage_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        endpoint VARCHAR(100) NOT NULL,
        prompt_tokens INTEGER DEFAULT 0,
        completion_tokens INTEGER DEFAULT 0,
        model_key VARCHAR(100),
        duration_ms INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);

      CREATE TABLE IF NOT EXISTS ownai_qa (
        id UUID PRIMARY KEY,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        topic VARCHAR(255) DEFAULT '',
        source VARCHAR(50) DEFAULT 'OWN AI',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_ownai_qa_created_at ON ownai_qa(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ownai_qa_topic ON ownai_qa(topic);

      CREATE TABLE IF NOT EXISTS code_library (
        id UUID PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        code TEXT NOT NULL,
        language VARCHAR(50) NOT NULL,
        category VARCHAR(100) DEFAULT '',
        tags JSONB DEFAULT '[]',
        complexity JSONB DEFAULT '{}',
        source VARCHAR(50) DEFAULT 'OWN AI',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_code_library_created_at ON code_library(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_code_library_language ON code_library(language);
      CREATE INDEX IF NOT EXISTS idx_code_library_category ON code_library(category);
    `);
    dbAvailable = true;
    logger.info('Database initialized');
  } finally {
    client.release();
  }
}

function isDbError(error) {
  return error?.code === 'ECONNREFUSED' || error?.code === 'ENOTFOUND' || /connect/i.test(error?.message || '');
}

export async function findUserByEmail(email) {
  if (!dbAvailable) return null;
  try {
    const { rows } = await getPool().query(
      'SELECT id, email, password_hash, created_at FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    return rows[0] || null;
  } catch (error) {
    if (isDbError(error)) return null;
    throw error;
  }
}

export async function createUser(email, passwordHash) {
  if (!dbAvailable) {
    const err = new Error('Database unavailable');
    err.code = 'DB_UNAVAILABLE';
    throw err;
  }
  const { rows } = await getPool().query(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
    [email.toLowerCase(), passwordHash]
  );
  return rows[0];
}

export async function logUsage({ userId, endpoint, promptTokens, completionTokens, modelKey, durationMs }) {
  if (!dbAvailable) return;
  try {
    await getPool().query(
      `INSERT INTO usage_logs (user_id, endpoint, prompt_tokens, completion_tokens, model_key, duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, endpoint, promptTokens, completionTokens, modelKey, durationMs]
    );
  } catch {
    // non-blocking
  }
}

export async function getUserUsageStats(userId) {
  if (!dbAvailable) {
    return { total_requests: 0, total_prompt_tokens: 0, total_completion_tokens: 0, avg_duration_ms: 0 };
  }
  try {
    const { rows } = await getPool().query(
    `SELECT
       COUNT(*)::int AS total_requests,
       COALESCE(SUM(prompt_tokens), 0)::int AS total_prompt_tokens,
       COALESCE(SUM(completion_tokens), 0)::int AS total_completion_tokens,
       COALESCE(AVG(duration_ms), 0)::int AS avg_duration_ms
     FROM usage_logs
     WHERE user_id = $1`,
    [userId]
    );
    return rows[0];
  } catch {
    return { total_requests: 0, total_prompt_tokens: 0, total_completion_tokens: 0, avg_duration_ms: 0 };
  }
}
