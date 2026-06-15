import pg from 'pg';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

let pool = null;

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
    `);
    logger.info('Database initialized');
  } finally {
    client.release();
  }
}

export async function findUserByEmail(email) {
  const { rows } = await getPool().query(
    'SELECT id, email, password_hash, created_at FROM users WHERE email = $1',
    [email.toLowerCase()]
  );
  return rows[0] || null;
}

export async function createUser(email, passwordHash) {
  const { rows } = await getPool().query(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
    [email.toLowerCase(), passwordHash]
  );
  return rows[0];
}

export async function logUsage({ userId, endpoint, promptTokens, completionTokens, modelKey, durationMs }) {
  await getPool().query(
    `INSERT INTO usage_logs (user_id, endpoint, prompt_tokens, completion_tokens, model_key, duration_ms)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, endpoint, promptTokens, completionTokens, modelKey, durationMs]
  );
}

export async function getUserUsageStats(userId) {
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
}
