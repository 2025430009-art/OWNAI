import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { getPool } from '../db/index.js';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_PATH = path.resolve(__dirname, '../../../data/ownai-qa-store.json');

export class OwnAIQaError extends Error {
  constructor(message, code = 'QA_ERROR') {
    super(message);
    this.name = 'OwnAIQaError';
    this.status = 400;
    this.code = code;
  }
}

let dbReady = null;

async function isDbAvailable() {
  if (dbReady !== null) return dbReady;
  try {
    await getPool().query('SELECT 1');
    await ensureTable();
    dbReady = true;
  } catch {
    dbReady = false;
    logger.warn('ownai-qa using JSON file store (database unavailable)');
  }
  return dbReady;
}

async function ensureTable() {
  await getPool().query(`
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
  `);
}

async function readJsonStore() {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeJsonStore(entries) {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(entries, null, 2), 'utf8');
}

function normalizeEntry(row) {
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    topic: row.topic || '',
    source: row.source || 'OWN AI',
    createdAt: row.created_at || row.createdAt,
  };
}

/**
 * Save a new Q&A pair.
 * @param {{ question: string, answer: string, topic?: string, source?: string }}
 */
export async function createQaEntry({ question, answer, topic = '', source = 'OWN AI' }) {
  if (!question?.trim()) throw new OwnAIQaError('question is required', 'INVALID_INPUT');
  if (!answer?.trim()) throw new OwnAIQaError('answer is required', 'INVALID_INPUT');

  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const entry = {
    id,
    question: question.trim(),
    answer: answer.trim(),
    topic: (topic || '').trim(),
    source: source || 'OWN AI',
    createdAt,
  };

  if (await isDbAvailable()) {
    await getPool().query(
      `INSERT INTO ownai_qa (id, question, answer, topic, source, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, entry.question, entry.answer, entry.topic, entry.source, createdAt],
    );
    return entry;
  }

  const store = await readJsonStore();
  store.unshift(entry);
  await writeJsonStore(store);
  return entry;
}

/**
 * List all entries, optionally filtered by search query and topic.
 * @param {{ q?: string, topic?: string }}
 */
export async function listQaEntries({ q, topic } = {}) {
  let entries = [];

  if (await isDbAvailable()) {
    let query = 'SELECT id, question, answer, topic, source, created_at FROM ownai_qa';
    const conditions = [];
    const params = [];

    if (topic) {
      params.push(topic);
      conditions.push(`topic = $${params.length}`);
    }
    if (q) {
      params.push(`%${q.toLowerCase()}%`);
      conditions.push(`(LOWER(question) LIKE $${params.length} OR LOWER(answer) LIKE $${params.length})`);
    }
    if (conditions.length) query += ` WHERE ${conditions.join(' AND ')}`;
    query += ' ORDER BY created_at DESC';

    const { rows } = await getPool().query(query, params);
    entries = rows.map(normalizeEntry);
  } else {
    entries = await readJsonStore();
    if (topic) entries = entries.filter((e) => e.topic === topic);
    if (q) {
      const needle = q.toLowerCase();
      entries = entries.filter(
        (e) => e.question.toLowerCase().includes(needle) || e.answer.toLowerCase().includes(needle),
      );
    }
    entries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  return entries;
}

/** @param {string} id */
export async function deleteQaEntry(id) {
  if (!id) throw new OwnAIQaError('id is required', 'INVALID_INPUT');

  if (await isDbAvailable()) {
    const { rowCount } = await getPool().query('DELETE FROM ownai_qa WHERE id = $1', [id]);
    if (!rowCount) throw new OwnAIQaError('Q&A entry not found', 'NOT_FOUND');
    return { deleted: true, id };
  }

  const store = await readJsonStore();
  const next = store.filter((e) => e.id !== id);
  if (next.length === store.length) throw new OwnAIQaError('Q&A entry not found', 'NOT_FOUND');
  await writeJsonStore(next);
  return { deleted: true, id };
}

/** @param {string} q */
export async function searchQaEntries(q) {
  return listQaEntries({ q });
}
