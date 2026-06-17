import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ChromaClient } from 'chromadb';
import { embedText } from './embeddings.js';
import { parsePdfBuffer } from '../utils/pdfParser.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FALLBACK_STORE = path.join(__dirname, '../../data/rag-engine-store.json');
const COLLECTION_BASE = 'ownai_docs';
const CHUNK_SIZE = 500;
const CHUNK_STEP = 450;

/** @type {ChromaClient|null} */
let chromaClient = null;
let chromaAvailable = null;

/** @type {{ chunks: Array<{ id: string, namespace: string, source: string, text: string, embedding: number[] }> }} */
let memoryStore = { chunks: [] };
let memoryLoaded = false;

function resolveNamespace(namespace) {
  return namespace == null || namespace === '' ? 'global' : String(namespace);
}

function collectionName(namespace) {
  return `${COLLECTION_BASE}_${resolveNamespace(namespace)}`;
}

function chunkTextWithOverlap(text) {
  const normalized = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const chunks = [];
  for (let i = 0; i < normalized.length; i += CHUNK_STEP) {
    chunks.push(normalized.slice(i, i + CHUNK_SIZE));
  }
  return chunks.filter(Boolean);
}

async function loadMemoryStore() {
  if (memoryLoaded) return;
  try {
    const raw = await fs.readFile(FALLBACK_STORE, 'utf-8');
    memoryStore = JSON.parse(raw);
  } catch {
    memoryStore = { chunks: [] };
  }
  memoryLoaded = true;
}

async function persistMemoryStore() {
  await fs.mkdir(path.dirname(FALLBACK_STORE), { recursive: true });
  await fs.writeFile(FALLBACK_STORE, JSON.stringify(memoryStore, null, 2));
}

async function getChromaClient() {
  if (chromaAvailable === false) return null;
  if (chromaClient) return chromaClient;

  try {
    const client = new ChromaClient();
    await client.heartbeat();
    chromaClient = client;
    chromaAvailable = true;
    logger.info('[RAG] ChromaDB connected');
    return client;
  } catch (error) {
    chromaAvailable = false;
    logger.warn('[RAG] ChromaDB unavailable — using in-memory vector store', { error: error.message });
    return null;
  }
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

async function extractText(filePath, filename) {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf')) {
    const buf = fsSync.readFileSync(filePath);
    const parsed = await parsePdfBuffer(buf);
    if (!parsed.text) {
      throw new Error(parsed.error || 'Could not extract text from PDF');
    }
    return parsed.text;
  }
  return fsSync.readFileSync(filePath, 'utf-8');
}

async function ingestToMemory(filename, chunks, namespace) {
  await loadMemoryStore();
  const ns = resolveNamespace(namespace);
  const source = filename;

  memoryStore.chunks = memoryStore.chunks.filter(
    (c) => !(c.namespace === ns && c.source === source),
  );

  for (let i = 0; i < chunks.length; i += 1) {
    const embedding = await embedText(chunks[i]);
    memoryStore.chunks.push({
      id: `${ns}:${filename}_${i}_${Date.now()}`,
      namespace: ns,
      source,
      text: chunks[i],
      embedding,
    });
  }

  await persistMemoryStore();
}

async function queryMemory(question, topK, namespace) {
  await loadMemoryStore();
  const ns = resolveNamespace(namespace);
  const scoped = memoryStore.chunks.filter((c) => c.namespace === ns);
  if (!scoped.length) return null;

  const queryEmbedding = await embedText(question);
  const scored = scoped
    .map((chunk) => ({ ...chunk, score: cosineSimilarity(queryEmbedding, chunk.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored.map((c) => c.text).join('\n\n---\n\n');
}

async function listMemory(namespace) {
  await loadMemoryStore();
  const ns = resolveNamespace(namespace);
  const sources = [...new Set(
    memoryStore.chunks.filter((c) => c.namespace === ns).map((c) => c.source),
  )];
  return sources;
}

/**
 * Ingest: extract text → chunk → embed → store
 */
export async function ingestDocument(filePath, filename, namespace = null) {
  const ns = resolveNamespace(namespace);
  const text = await extractText(filePath, filename);
  const chunks = chunkTextWithOverlap(text);

  if (!chunks.length) {
    return { chunks: 0, filename };
  }

  const existing = await listDocuments(namespace);
  const isUpdate = existing.includes(filename);
  if (!isUpdate && existing.length >= config.rag.maxDocsPerUser) {
    const err = new Error('RAG quota exceeded');
    err.status = 429;
    throw err;
  }

  const chroma = await getChromaClient();
  if (chroma) {
    try {
      const collection = await chroma.getOrCreateCollection({ name: collectionName(ns) });
      await collection.delete({ where: { source: filename } }).catch(() => {});

      for (let i = 0; i < chunks.length; i += 1) {
        const embedding = await embedText(chunks[i]);
        await collection.add({
          ids: [`${filename}_${i}_${Date.now()}`],
          embeddings: [embedding],
          documents: [chunks[i]],
          metadatas: [{ source: filename, chunk: i, namespace: ns, sessionId: ns }],
        });
      }

      logger.info('[RAG] ingested via ChromaDB', { filename, chunks: chunks.length, namespace: ns });
      return { chunks: chunks.length, filename };
    } catch (error) {
      logger.warn('[RAG] Chroma ingest failed — falling back to memory store', { error: error.message });
    }
  }

  await ingestToMemory(filename, chunks, ns);
  logger.info('[RAG] ingested via memory store', { filename, chunks: chunks.length, namespace: ns });
  return { chunks: chunks.length, filename };
}

/**
 * Query: embed question → find similar chunks
 */
export async function queryDocuments(question, topK = 4, namespace = null) {
  const ns = resolveNamespace(namespace);

  async function queryScoped(scopeNs) {
    try {
      const chroma = await getChromaClient();
      if (chroma) {
        const collection = await chroma.getOrCreateCollection({ name: collectionName(scopeNs) });
        const embedding = await embedText(question);
        const results = await collection.query({
          queryEmbeddings: [embedding],
          nResults: topK,
        });
        const docs = results.documents?.[0]?.filter(Boolean) || [];
        if (docs.length) return docs.join('\n\n---\n\n');
      }
    } catch {
      // fall through
    }
    return queryMemory(question, topK, scopeNs);
  }

  let result = await queryScoped(ns);
  if (!result && ns !== 'global') {
    result = await queryScoped('global');
  }
  return result || null;
}

/** List ingested document filenames */
export async function listDocuments(namespace = null) {
  const ns = resolveNamespace(namespace);

  try {
    const chroma = await getChromaClient();
    if (chroma) {
      const collection = await chroma.getOrCreateCollection({ name: collectionName(ns) });
      const all = await collection.get();
      const sources = [...new Set((all.metadatas || []).map((m) => m?.source).filter(Boolean))];
      if (sources.length) return sources;
    }
  } catch {
    // fall through
  }

  return listMemory(ns);
}

export async function clearDocuments(namespace = null) {
  const ns = resolveNamespace(namespace);

  try {
    const chroma = await getChromaClient();
    if (chroma) {
      await chroma.deleteCollection({ name: collectionName(ns) }).catch(() => {});
    }
  } catch {
    // ignore
  }

  await loadMemoryStore();
  memoryStore.chunks = memoryStore.chunks.filter((c) => c.namespace !== ns);
  await persistMemoryStore();
}

export function buildRagPrompt(userMessage, ragContext) {
  if (!ragContext?.trim()) return userMessage;

  const formatHints = {
    latex: 'Convert the document content to proper LaTeX with \\documentclass, sections, and formatting. Output complete LaTeX only — no placeholders.',
    summarize: 'Write a clear, accurate summary of the document content below.',
    translate: 'Translate the document content as requested by the user.',
    table: 'Extract data from the document and format it as a readable table.',
  };

  const lower = userMessage.toLowerCase();
  const formatKey = Object.keys(formatHints).find((k) => lower.includes(k));
  const formatInstruction = formatHints[formatKey]
    || 'Answer the user request using ONLY the document content below. Do NOT return placeholder code, TODO comments, or generic templates.';

  return `You are OWNAI. The user has uploaded documents.
${formatInstruction}
Use the following extracted content to answer their request EXACTLY.
If they ask to convert to LaTeX, convert the ACTUAL content below to LaTeX.
If they ask to summarize, summarize the ACTUAL content below.
Never return placeholder code with TODO comments.

===== DOCUMENT CONTENT =====
${ragContext}
===========================

USER REQUEST: ${userMessage}`;
}

export function buildRagSystemPrompt(ragContext) {
  if (!ragContext?.trim()) {
    return `You are OWNAI, an advanced AI assistant.
Answer the user's request directly and completely.
Never return placeholder code with TODO comments.
Always provide complete, working responses.`;
  }

  return `You are OWNAI. The user has uploaded documents.
Use the extracted document content provided in the user message to answer EXACTLY.
Do NOT return placeholder code. Do NOT return TODO comments.
If they ask for LaTeX, output real LaTeX from the document content.
If they ask to summarize, summarize the actual uploaded document.`;
}
