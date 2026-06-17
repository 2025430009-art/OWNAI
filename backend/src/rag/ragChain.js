import path from 'path';
import {
  ingestDocument as engineIngest,
  queryDocuments as engineQuery,
  listDocuments,
  clearDocuments,
  buildRagPrompt,
} from './ragEngine.js';
import { ingestDocument as legacyIngest } from './vectorStore.js';
import { buildConversationHistory } from '../utils/conversationHistory.js';
import { vectorStore } from './vectorStore.js';

export async function ingestFile(filePath, originalName, namespace = null) {
  const filename = path.basename(originalName || filePath);
  const result = await engineIngest(filePath, filename, namespace);
  return result.chunks;
}

export async function buildRagContext(question, topK = 3, namespace = null) {
  const context = await engineQuery(question, topK, namespace);
  if (!context) return null;
  return context;
}

export function augmentPromptWithRag(userMessage, ragContext, messages = []) {
  const enriched = buildRagPrompt(userMessage, ragContext);
  return buildConversationHistory(messages, enriched);
}

export async function ragStatus(namespace = null) {
  const documents = await listDocuments(namespace);
  const legacy = await vectorStore.status(namespace).catch(() => ({
    chunkCount: 0,
    documentCount: 0,
    sources: [],
  }));

  const sources = [...new Set([...documents, ...legacy.sources])];
  return {
    namespace: namespace == null || namespace === '' ? 'global' : String(namespace),
    chunkCount: legacy.chunkCount,
    documentCount: sources.length,
    sources,
    documents,
  };
}

export async function clearRagStore(namespace = null) {
  await clearDocuments(namespace);
  await vectorStore.clear(namespace);
}

export async function queryDocuments(question, topK = 3, namespace = null) {
  return engineQuery(question, topK, namespace);
}

export async function ingestDocument(filename, texts, namespace = null) {
  return legacyIngest(filename, texts, namespace);
}

export { listDocuments, buildRagPrompt, buildRagSystemPrompt } from './ragEngine.js';
