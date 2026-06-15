import { loadDocument, chunkText } from './documentLoader.js';
import { ingestDocument, queryDocuments, vectorStore } from './vectorStore.js';
import { OWNAI_SYSTEM_PROMPT } from '../config/personality.js';
import { buildConversationHistory } from '../utils/conversationHistory.js';

export async function ingestFile(filePath, originalName) {
  const { text, filename } = await loadDocument(filePath, originalName);
  const chunks = chunkText(text, 500);
  if (!chunks.length) return 0;
  return ingestDocument(filename, chunks);
}

export async function buildRagContext(question, topK = 3) {
  const context = await queryDocuments(question, topK);
  if (!context) return null;
  return context;
}

export function augmentPromptWithRag(userMessage, ragContext, messages = []) {
  const enriched = ragContext
    ? `Context from my documents:\n${ragContext}\n\nQuestion: ${userMessage}`
    : userMessage;

  return buildConversationHistory(messages, enriched);
}

export function buildRagSystemPrompt() {
  return `${OWNAI_SYSTEM_PROMPT}

When document context is provided, prioritize it over general knowledge. Cite the source document when relevant.`;
}

export async function ragStatus() {
  return vectorStore.status();
}

export { queryDocuments, ingestDocument };
