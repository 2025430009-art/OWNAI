import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { embedText } from './embeddings.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_PATH = path.join(__dirname, '../../data/rag-store.json');

function resolveNamespace(namespace) {
  return namespace == null || namespace === '' ? 'global' : String(namespace);
}

function namespacedKey(namespace, key) {
  return `${resolveNamespace(namespace)}:${key}`;
}

function chunkNamespace(chunk) {
  return chunk.namespace || 'global';
}

function chunksForNamespace(chunks, namespace) {
  const ns = resolveNamespace(namespace);
  return chunks.filter((chunk) => chunkNamespace(chunk) === ns);
}

function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

class VectorStore {
  constructor() {
    this.chunks = [];
    this.loaded = false;
  }

  async load() {
    if (this.loaded) return;
    try {
      const raw = await fs.readFile(STORE_PATH, 'utf-8');
      const data = JSON.parse(raw);
      this.chunks = data.chunks || [];
    } catch {
      this.chunks = [];
    }
    this.loaded = true;
  }

  async persist() {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify({ chunks: this.chunks }, null, 2));
  }

  async addChunks(filename, texts, namespace = null) {
    await this.load();
    const ns = resolveNamespace(namespace);
    const sourceKey = namespacedKey(ns, filename);

    for (let i = 0; i < texts.length; i += 1) {
      const embedding = await embedText(texts[i]);
      this.chunks.push({
        id: namespacedKey(ns, `${filename}_chunk_${i}_${Date.now()}`),
        namespace: ns,
        source: sourceKey,
        text: texts[i],
        embedding,
      });
    }
    await this.persist();
    return texts.length;
  }

  async search(query, topK = 3, namespace = null) {
    await this.load();
    const scoped = chunksForNamespace(this.chunks, namespace);
    if (!scoped.length) return [];

    const queryEmbedding = await embedText(query);
    const scored = scoped.map((chunk) => ({
      ...chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }));

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(({ id, source, text, score }) => ({ id, source, text, score }));
  }

  async status(namespace = null) {
    await this.load();
    const scoped = chunksForNamespace(this.chunks, namespace);
    const sources = [...new Set(scoped.map((c) => c.source))];
    return {
      namespace: resolveNamespace(namespace),
      chunkCount: scoped.length,
      documentCount: sources.length,
      sources,
    };
  }

  async countDocuments(namespace = null) {
    const { documentCount } = await this.status(namespace);
    return documentCount;
  }

  async clear(namespace = null) {
    await this.load();
    const ns = resolveNamespace(namespace);
    this.chunks = this.chunks.filter((chunk) => chunkNamespace(chunk) !== ns);
    this.loaded = true;
    await this.persist();
  }
}

export const vectorStore = new VectorStore();

export class RagQuotaError extends Error {
  constructor(message = 'RAG quota exceeded') {
    super(message);
    this.name = 'RagQuotaError';
    this.status = 429;
  }
}

export async function ingestDocument(filename, texts, namespace = null) {
  const ns = resolveNamespace(namespace);
  const currentDocs = await vectorStore.countDocuments(ns);
  if (currentDocs >= config.rag.maxDocsPerUser) {
    throw new RagQuotaError();
  }

  const count = await vectorStore.addChunks(filename, texts, ns);
  logger.info('RAG ingested document', { filename, chunks: count, namespace: ns });
  return count;
}

export async function queryDocuments(question, topK = 3, namespace = null) {
  const results = await vectorStore.search(question, topK, namespace);
  if (!results.length) return '';
  return results.map((r) => r.text).join('\n\n---\n\n');
}
