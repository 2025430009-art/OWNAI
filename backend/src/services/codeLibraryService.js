import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { getPool } from '../db/index.js';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_PATH = path.resolve(__dirname, '../../../data/code-library-store.json');

export class CodeLibraryError extends Error {
  constructor(message, code = 'CODE_LIBRARY_ERROR') {
    super(message);
    this.name = 'CodeLibraryError';
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
    logger.warn('code-library using JSON file store (database unavailable)');
  }
  return dbReady;
}

async function ensureTable() {
  await getPool().query(`
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
  const complexity = row.complexity || {};
  if (typeof complexity === 'string') {
    try {
      Object.assign(complexity, JSON.parse(row.complexity));
    } catch {
      // keep empty
    }
  }
  let tags = row.tags || [];
  if (typeof tags === 'string') {
    try {
      tags = JSON.parse(tags);
    } catch {
      tags = [];
    }
  }
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    code: row.code,
    language: row.language,
    category: row.category || '',
    tags,
    complexity: {
      time: complexity.time || '',
      space: complexity.space || '',
    },
    source: row.source || 'OWN AI',
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt,
  };
}

function validateEntryInput(data, partial = false) {
  if (!partial && !data.title?.trim()) {
    throw new CodeLibraryError('title is required', 'INVALID_INPUT');
  }
  if (!partial && !data.code?.trim()) {
    throw new CodeLibraryError('code is required', 'INVALID_INPUT');
  }
  if (!partial && !data.language?.trim()) {
    throw new CodeLibraryError('language is required', 'INVALID_INPUT');
  }
}

function applyFilters(entries, { q, lang, type, sort = 'newest' }) {
  let result = [...entries];

  if (lang) result = result.filter((e) => e.language.toLowerCase() === lang.toLowerCase());
  if (type) result = result.filter((e) => e.category.toLowerCase() === type.toLowerCase());

  if (q) {
    const needle = q.toLowerCase();
    result = result.filter((e) => {
      const hay = [
        e.title,
        e.description,
        e.code,
        e.language,
        e.category,
        ...(e.tags || []),
      ].join(' ').toLowerCase();
      return hay.includes(needle);
    });
  }

  if (sort === 'oldest') {
    result.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  } else if (sort === 'az') {
    result.sort((a, b) => a.title.localeCompare(b.title));
  } else {
    result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  return result;
}

/**
 * @param {object} data
 */
export async function createCodeEntry(data) {
  validateEntryInput(data);
  const id = randomUUID();
  const now = new Date().toISOString();
  const entry = {
    id,
    title: data.title.trim(),
    description: (data.description || '').trim(),
    code: data.code,
    language: data.language.trim().toLowerCase(),
    category: (data.category || '').trim(),
    tags: Array.isArray(data.tags) ? data.tags : [],
    complexity: {
      time: data.complexity?.time || '',
      space: data.complexity?.space || '',
    },
    source: data.source || 'OWN AI',
    createdAt: now,
    updatedAt: now,
  };

  if (await isDbAvailable()) {
    await getPool().query(
      `INSERT INTO code_library (id, title, description, code, language, category, tags, complexity, source, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        id, entry.title, entry.description, entry.code, entry.language,
        entry.category, JSON.stringify(entry.tags), JSON.stringify(entry.complexity),
        entry.source, now, now,
      ],
    );
    return entry;
  }

  const store = await readJsonStore();
  store.unshift(entry);
  await writeJsonStore(store);
  return entry;
}

export async function listCodeEntries(filters = {}) {
  let entries = [];

  if (await isDbAvailable()) {
    const { rows } = await getPool().query(
      `SELECT id, title, description, code, language, category, tags, complexity, source, created_at, updated_at
       FROM code_library ORDER BY created_at DESC`,
    );
    entries = rows.map(normalizeEntry);
  } else {
    entries = await readJsonStore();
  }

  return applyFilters(entries, filters);
}

export async function getCodeEntry(id) {
  if (!id) throw new CodeLibraryError('id is required', 'INVALID_INPUT');

  if (await isDbAvailable()) {
    const { rows } = await getPool().query(
      `SELECT id, title, description, code, language, category, tags, complexity, source, created_at, updated_at
       FROM code_library WHERE id = $1`,
      [id],
    );
    if (!rows[0]) throw new CodeLibraryError('Entry not found', 'NOT_FOUND');
    return normalizeEntry(rows[0]);
  }

  const store = await readJsonStore();
  const entry = store.find((e) => e.id === id);
  if (!entry) throw new CodeLibraryError('Entry not found', 'NOT_FOUND');
  return entry;
}

export async function updateCodeEntry(id, data) {
  const existing = await getCodeEntry(id);
  if (data.title !== undefined && !data.title?.trim()) {
    throw new CodeLibraryError('title cannot be empty', 'INVALID_INPUT');
  }
  if (data.code !== undefined && !data.code?.trim()) {
    throw new CodeLibraryError('code cannot be empty', 'INVALID_INPUT');
  }
  if (data.language !== undefined && !data.language?.trim()) {
    throw new CodeLibraryError('language cannot be empty', 'INVALID_INPUT');
  }

  const updated = {
    ...existing,
    title: data.title?.trim() ?? existing.title,
    description: data.description?.trim() ?? existing.description,
    code: data.code ?? existing.code,
    language: (data.language?.trim().toLowerCase()) ?? existing.language,
    category: data.category?.trim() ?? existing.category,
    tags: data.tags ?? existing.tags,
    complexity: data.complexity ?? existing.complexity,
    updatedAt: new Date().toISOString(),
  };

  if (await isDbAvailable()) {
    await getPool().query(
      `UPDATE code_library SET title=$2, description=$3, code=$4, language=$5, category=$6,
       tags=$7, complexity=$8, updated_at=$9 WHERE id=$1`,
      [
        id, updated.title, updated.description, updated.code, updated.language,
        updated.category, JSON.stringify(updated.tags), JSON.stringify(updated.complexity),
        updated.updatedAt,
      ],
    );
    return updated;
  }

  const store = await readJsonStore();
  const idx = store.findIndex((e) => e.id === id);
  store[idx] = updated;
  await writeJsonStore(store);
  return updated;
}

export async function deleteCodeEntry(id) {
  if (!id) throw new CodeLibraryError('id is required', 'INVALID_INPUT');

  if (await isDbAvailable()) {
    const { rowCount } = await getPool().query('DELETE FROM code_library WHERE id = $1', [id]);
    if (!rowCount) throw new CodeLibraryError('Entry not found', 'NOT_FOUND');
    return { deleted: true, id };
  }

  const store = await readJsonStore();
  const next = store.filter((e) => e.id !== id);
  if (next.length === store.length) throw new CodeLibraryError('Entry not found', 'NOT_FOUND');
  await writeJsonStore(next);
  return { deleted: true, id };
}

export async function searchCodeEntries(q, filters = {}) {
  return listCodeEntries({ ...filters, q });
}

export async function filterCodeEntries({ lang, type, ...rest } = {}) {
  return listCodeEntries({ ...rest, lang, type });
}
