import { getPool, isDatabaseAvailable } from '../db/index.js';
import { vectorStore } from '../rag/vectorStore.js';
import { runThinkingGeneration } from '../services/thinkingGenerationService.js';
import { extractJSON } from './refinementEngine.js';
import { logger } from '../utils/logger.js';

export const MEMORY_TYPES = ['fact', 'preference', 'skill', 'project', 'relationship'];
export const EDGE_RELATIONS = ['related_to', 'part_of', 'causes', 'contradicts', 'supports'];

function clampConfidence(value, fallback = 0.8) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(1, num));
}

function clampStrength(value, fallback = 0.5) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(1, num));
}

function extractKeywords(message) {
  return String(message || '')
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9_-]/g, ''))
    .filter((word) => word.length > 4)
    .slice(0, 8);
}

function buildExtractPrompt(message, response) {
  return `Extract memorable facts from this conversation.

USER MESSAGE: ${message}
AI RESPONSE: ${response}

What should be remembered long-term? Respond in JSON only:
{
  "memories": [
    {
      "type": "fact|preference|skill|project|relationship",
      "content": "Concise statement to remember",
      "confidence": 0.0-1.0,
      "tags": ["tag1", "tag2"],
      "expires_in_days": null
    }
  ],
  "edges": [
    {
      "from_content": "memory content A",
      "to_content": "memory content B",
      "relation": "related_to|part_of|causes|contradicts|supports",
      "strength": 0.0-1.0
    }
  ]
}`;
}

export function parseMemoryExtraction(rawText) {
  try {
    const jsonStr = extractJSON(rawText);
    if (!jsonStr) throw new Error('No JSON');
    const parsed = JSON.parse(jsonStr);
    return {
      memories: Array.isArray(parsed.memories) ? parsed.memories : [],
      edges: Array.isArray(parsed.edges) ? parsed.edges : [],
    };
  } catch {
    return { memories: [], edges: [] };
  }
}

async function defaultCallAI(prompt) {
  let output = '';
  await runThinkingGeneration({
    prompt,
    maxTokens: 1024,
    temperature: 0.2,
    reasoningMode: 'direct',
    onEvent: (event) => {
      if (event.type === 'text') output += event.token;
      if (event.type === 'text_replace') output = event.text;
    },
  });
  return output;
}

async function indexMemoryInVectorStore(userId, memoryId, content) {
  try {
    const namespace = String(userId);
    await vectorStore.addChunks(`memory_${memoryId}`, [content], namespace);
  } catch (error) {
    logger.warn('Failed to index memory in vector store', { error: error.message, memoryId });
  }
}

async function recallByVector(message, userId, limit) {
  try {
    const results = await vectorStore.search(message, limit, String(userId));
    return results
      .filter((item) => item.source?.includes('memory_'))
      .map((item) => ({
        id: item.id,
        content: item.text,
        type: 'fact',
        confidence: 0.75,
        tags: [],
        access_count: 0,
        source: 'vector',
        score: item.score,
      }));
  } catch {
    return [];
  }
}

async function recallByFullText(keywords, userId, limit) {
  if (!isDatabaseAvailable() || userId == null) return [];

  const queryText = keywords.join(' ') || 'memory';
  const { rows } = await getPool().query(
    `SELECT *,
            ts_rank(to_tsvector('english', content), plainto_tsquery('english', $1)) AS rank
     FROM memories
     WHERE user_id = $2
       AND (expires_at IS NULL OR expires_at > now())
       AND (
         to_tsvector('english', content) @@ plainto_tsquery('english', $1)
         OR EXISTS (
           SELECT 1 FROM unnest(tags) AS tag
           WHERE tag ILIKE ANY($4)
         )
       )
     ORDER BY rank DESC, access_count DESC, last_accessed DESC
     LIMIT $3`,
    [queryText, userId, limit, keywords.map((k) => `%${k}%`)],
  );

  return rows;
}

async function recallByKeywordFallback(keywords, userId, limit) {
  if (!isDatabaseAvailable() || userId == null) return [];
  if (!keywords.length) {
    const { rows } = await getPool().query(
      `SELECT * FROM memories
       WHERE user_id = $1 AND (expires_at IS NULL OR expires_at > now())
       ORDER BY access_count DESC, last_accessed DESC
       LIMIT $2`,
      [userId, limit],
    );
    return rows;
  }

  const patterns = keywords.map((k) => `%${k}%`);
  const { rows } = await getPool().query(
    `SELECT * FROM memories
     WHERE user_id = $1
       AND (expires_at IS NULL OR expires_at > now())
       AND (
         content ILIKE ANY($2)
         OR EXISTS (SELECT 1 FROM unnest(tags) AS tag WHERE tag ILIKE ANY($2))
       )
     ORDER BY access_count DESC, last_accessed DESC
     LIMIT $3`,
    [userId, patterns, limit],
  );
  return rows;
}

async function touchMemories(ids) {
  if (!ids.length || !isDatabaseAvailable()) return;
  await getPool().query(
    `UPDATE memories
     SET access_count = access_count + 1, last_accessed = now()
     WHERE id = ANY($1::uuid[])`,
    [ids],
  );
}

function mergeRecallResults(fullTextRows, vectorRows, limit) {
  const seen = new Set();
  const merged = [];

  for (const row of [...fullTextRows, ...vectorRows]) {
    const key = row.id || row.content;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
    if (merged.length >= limit) break;
  }

  return merged;
}

export async function saveMemory(
  userId,
  type,
  content,
  tags = [],
  confidence = 0.8,
  extras = {},
) {
  if (!isDatabaseAvailable() || userId == null) {
    throw new Error('Database unavailable or user not authenticated');
  }

  const normalizedType = MEMORY_TYPES.includes(type) ? type : 'fact';
  let expiresAt = null;
  if (extras.expires_in_days != null) {
    const days = Number(extras.expires_in_days);
    if (Number.isFinite(days) && days > 0) {
      expiresAt = new Date(Date.now() + days * 86400000);
    }
  }

  const { rows } = await getPool().query(
    `INSERT INTO memories (user_id, type, content, source_message, tags, confidence, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      userId,
      normalizedType,
      content,
      extras.source_message || null,
      tags,
      clampConfidence(confidence),
      expiresAt,
    ],
  );

  const memory = rows[0];
  const embeddingKey = `memory:${memory.id}`;
  await getPool().query(
    'UPDATE memories SET embedding_key = $1 WHERE id = $2',
    [embeddingKey, memory.id],
  );
  memory.embedding_key = embeddingKey;

  await indexMemoryInVectorStore(userId, memory.id, content);
  return memory;
}

async function saveKnowledgeEdge(userId, fromMemoryId, toMemoryId, relation, strength = 0.5) {
  if (!isDatabaseAvailable()) return null;
  const normalizedRelation = EDGE_RELATIONS.includes(relation) ? relation : 'related_to';

  const { rows } = await getPool().query(
    `INSERT INTO knowledge_edges (user_id, from_memory_id, to_memory_id, relation, strength)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, fromMemoryId, toMemoryId, normalizedRelation, clampStrength(strength)],
  );
  return rows[0];
}

export async function forgetMemory(memoryId, userId) {
  if (!isDatabaseAvailable() || userId == null) return null;

  const { rows } = await getPool().query(
    `UPDATE memories SET expires_at = now()
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [memoryId, userId],
  );
  return rows[0] || null;
}

export async function listMemories(userId, type = null) {
  if (!isDatabaseAvailable() || userId == null) return [];

  if (type && MEMORY_TYPES.includes(type)) {
    const { rows } = await getPool().query(
      `SELECT id, type, content, confidence, tags, access_count, last_accessed,
              expires_at, created_at
       FROM memories
       WHERE user_id = $1 AND type = $2 AND (expires_at IS NULL OR expires_at > now())
       ORDER BY created_at DESC`,
      [userId, type],
    );
    return rows;
  }

  const { rows } = await getPool().query(
    `SELECT id, type, content, confidence, tags, access_count, last_accessed,
            expires_at, created_at
     FROM memories
     WHERE user_id = $1 AND (expires_at IS NULL OR expires_at > now())
     ORDER BY type, created_at DESC`,
    [userId],
  );
  return rows;
}

export async function getKnowledgeGraph(userId) {
  if (!isDatabaseAvailable() || userId == null) {
    return { nodes: [], edges: [] };
  }

  const [memoriesResult, edgesResult] = await Promise.all([
    getPool().query(
      `SELECT id, type, content, confidence, tags
       FROM memories
       WHERE user_id = $1 AND (expires_at IS NULL OR expires_at > now())`,
      [userId],
    ),
    getPool().query(
      `SELECT e.id, e.from_memory_id, e.to_memory_id, e.relation, e.strength,
              fm.content AS from_content, tm.content AS to_content
       FROM knowledge_edges e
       JOIN memories fm ON fm.id = e.from_memory_id
       JOIN memories tm ON tm.id = e.to_memory_id
       WHERE e.user_id = $1`,
      [userId],
    ),
  ]);

  return {
    nodes: memoriesResult.rows.map((row) => ({
      id: row.id,
      type: row.type,
      content: row.content,
      confidence: row.confidence,
      tags: row.tags,
    })),
    edges: edgesResult.rows.map((row) => ({
      id: row.id,
      from: row.from_memory_id,
      to: row.to_memory_id,
      from_content: row.from_content,
      to_content: row.to_content,
      relation: row.relation,
      strength: row.strength,
    })),
  };
}

export async function recallRelevantMemories(message, userId, limit = 5) {
  if (!isDatabaseAvailable() || userId == null) return [];

  const keywords = extractKeywords(message);
  let rows = [];

  try {
    rows = await recallByFullText(keywords, userId, limit);
  } catch {
    rows = await recallByKeywordFallback(keywords, userId, limit);
  }

  const vectorRows = await recallByVector(message, userId, limit);
  const merged = mergeRecallResults(rows, vectorRows, limit);

  const ids = merged.filter((row) => row.id).map((row) => row.id);
  if (ids.length) {
    await touchMemories(ids);
  }

  return merged;
}

export async function buildMemoryContext(message, userId) {
  const memories = await recallRelevantMemories(message, userId);
  if (!memories.length) return '';

  return `WHAT I REMEMBER ABOUT YOU:
${memories.map((m) => `- [${m.type}] ${m.content} (confidence: ${Math.round((m.confidence || 0.8) * 100)}%)`).join('\n')}

Use this context to personalize your response.
---`;
}

export function applyMemoryPrefixToHistory(history, memoryPrefix) {
  if (!memoryPrefix?.trim()) return history;

  const updated = [...history];
  const sysIdx = updated.findIndex((turn) => turn.role === 'system');
  if (sysIdx >= 0) {
    updated[sysIdx] = {
      role: 'system',
      content: `${memoryPrefix}\n\n${updated[sysIdx].content}`,
    };
  } else {
    updated.unshift({ role: 'system', content: memoryPrefix });
  }
  return updated;
}

export async function extractMemoriesFromMessage(message, response, userId, options = {}) {
  if (!isDatabaseAvailable() || userId == null || !message?.trim() || !response?.trim()) {
    return { saved: [], edges: [] };
  }

  const { callAI = defaultCallAI } = options;
  const extractPrompt = buildExtractPrompt(message, response);
  const aiOutput = await callAI(extractPrompt);
  const { memories, edges } = parseMemoryExtraction(aiOutput);

  const savedMemories = [];
  const contentToId = new Map();

  for (const item of memories) {
    if (!item?.content?.trim()) continue;
    if (!MEMORY_TYPES.includes(item.type)) item.type = 'fact';

    const memory = await saveMemory(
      userId,
      item.type,
      item.content.trim(),
      Array.isArray(item.tags) ? item.tags : [],
      clampConfidence(item.confidence),
      { source_message: message, expires_in_days: item.expires_in_days },
    );

    savedMemories.push(memory);
    contentToId.set(item.content.trim().toLowerCase(), memory.id);
  }

  const savedEdges = [];
  for (const edge of edges) {
    const fromId = contentToId.get(String(edge.from_content || '').trim().toLowerCase());
    const toId = contentToId.get(String(edge.to_content || '').trim().toLowerCase());
    if (!fromId || !toId || fromId === toId) continue;

    const saved = await saveKnowledgeEdge(
      userId,
      fromId,
      toId,
      edge.relation,
      edge.strength,
    );
    if (saved) savedEdges.push(saved);
  }

  return { saved: savedMemories, edges: savedEdges };
}

export function scheduleMemoryExtraction(message, response, userId) {
  if (!userId || !message?.trim() || !response?.trim()) return;

  setImmediate(() => {
    extractMemoriesFromMessage(message, response, userId).catch((error) => {
      logger.warn('Background memory extraction failed', { error: error.message });
    });
  });
}
