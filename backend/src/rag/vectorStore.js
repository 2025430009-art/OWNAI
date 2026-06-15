import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { embedText } from './embeddings.js';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_PATH = path.join(__dirname, '../../data/rag-store.json');

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

  async addChunks(filename, texts) {
    await this.load();
    for (let i = 0; i < texts.length; i += 1) {
      const embedding = await embedText(texts[i]);
      this.chunks.push({
        id: `${filename}_chunk_${i}_${Date.now()}`,
        source: filename,
        text: texts[i],
        embedding,
      });
    }
    await this.persist();
    return texts.length;
  }

  async search(query, topK = 3) {
    await this.load();
    if (!this.chunks.length) return [];

    const queryEmbedding = await embedText(query);
    const scored = this.chunks.map((chunk) => ({
      ...chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }));

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(({ id, source, text, score }) => ({ id, source, text, score }));
  }

  async status() {
    await this.load();
    const sources = [...new Set(this.chunks.map((c) => c.source))];
    return {
      chunkCount: this.chunks.length,
      documentCount: sources.length,
      sources,
    };
  }

  async clear() {
    this.chunks = [];
    this.loaded = true;
    await this.persist();
  }
}

export const vectorStore = new VectorStore();

export async function ingestDocument(filename, texts) {
  const count = await vectorStore.addChunks(filename, texts);
  logger.info('RAG ingested document', { filename, chunks: count });
  return count;
}

export async function queryDocuments(question, topK = 3) {
  const results = await vectorStore.search(question, topK);
  if (!results.length) return '';
  return results.map((r) => r.text).join('\n\n---\n\n');
}
