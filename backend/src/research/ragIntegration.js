import { ingestDocument } from '../rag/ragChain.js';
import { vectorStore, RagQuotaError } from '../rag/vectorStore.js';
import { logger } from '../utils/logger.js';
import { listActiveProjectsForUser } from '../services/researchService.js';
import { messageHasResearchKeywords, RESEARCH_KEYWORDS } from './researchKeywords.js';

export { RESEARCH_KEYWORDS, messageHasResearchKeywords } from './researchKeywords.js';

/**
 * @param {number|string} userId
 * @param {string} projectId
 * @returns {string}
 */
export function buildResearchNamespace(userId, projectId) {
  return `research:${userId}:${projectId}`;
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function containsResearchKeywords(text) {
  return messageHasResearchKeywords(text);
}

/**
 * @param {object} paper
 * @returns {string}
 */
export function buildPaperDocument(paper) {
  const authors = Array.isArray(paper.authors)
    ? paper.authors.join(', ')
    : (paper.authors || 'Unknown');

  let metrics = paper.metrics ?? {};
  if (typeof metrics === 'string') {
    try {
      metrics = JSON.parse(metrics);
    } catch {
      metrics = {};
    }
  }

  const metricLines = Object.entries(metrics)
    .map(([key, value]) => `  ${key}: ${JSON.stringify(value)}`)
    .join('\n');

  const lines = [
    `Title: ${paper.title}`,
    `Authors: ${authors}`,
    `Journal: ${paper.journal || 'N/A'}`,
    `Year: ${paper.year ?? 'N/A'}`,
    `DOI: ${paper.doi || 'N/A'}`,
    `Category: ${paper.category || 'N/A'}`,
    '',
    `Key contribution: ${paper.key_contribution || 'N/A'}`,
    '',
    `Limitation / research gap: ${paper.limitation_gap || 'N/A'}`,
  ];

  if (metricLines) {
    lines.push('', 'Metrics:', metricLines);
  }

  return lines.join('\n');
}

/**
 * @param {object} paper
 * @param {number|string} userId
 * @param {string} projectId
 * @returns {Promise<{ success: boolean, docId: string, namespace: string, chunks?: number, error?: string }>}
 */
export async function ingestPaperToRAG(paper, userId, projectId) {
  const namespace = buildResearchNamespace(userId, projectId);
  const docId = `paper_${paper.id}.txt`;
  const documentText = buildPaperDocument(paper);

  try {
    const chunks = await ingestDocument(docId, [documentText], namespace);
    logger.info('Research paper ingested to RAG', {
      paperId: paper.id,
      projectId,
      namespace,
      chunks,
    });
    return { success: true, docId, namespace, chunks };
  } catch (error) {
    if (error instanceof RagQuotaError) {
      logger.warn('Research paper RAG quota exceeded', { paperId: paper.id, namespace });
      return { success: false, docId, namespace, error: error.message };
    }
    logger.error('Research paper RAG ingest failed', {
      paperId: paper.id,
      namespace,
      error: error.message,
    });
    return { success: false, docId, namespace, error: error.message };
  }
}

/**
 * @param {string} query
 * @param {number|string} userId
 * @param {string} projectId
 * @returns {Promise<Array<{ id: string, source: string, text: string, score: number }>>}
 */
export async function queryResearchContext(query, userId, projectId) {
  const namespace = buildResearchNamespace(userId, projectId);
  return vectorStore.search(query, 5, namespace);
}

/**
 * @param {string} basePrompt
 * @param {number|string} userId
 * @param {string} projectId
 * @returns {Promise<string>}
 */
export async function buildAugmentedPrompt(basePrompt, userId, projectId) {
  const chunks = await queryResearchContext(basePrompt, userId, projectId);
  if (!chunks.length) {
    return basePrompt;
  }

  const summaries = chunks.map((chunk, index) => `[Paper ${index + 1} summary]\n${chunk.text}`);
  return [
    'RELEVANT PAPERS FROM YOUR LITERATURE DATABASE:',
    ...summaries,
    '---',
    'YOUR TASK:',
    basePrompt,
  ].join('\n\n');
}

/**
 * Query research namespaces across active projects for main chat augmentation.
 * @param {string} query
 * @param {number|string} userId
 * @returns {Promise<{ projectTitle: string, contextText: string, systemPrefix: string }|null>}
 */
export async function getResearchChatAugmentation(query, userId) {
  if (userId == null || userId === 'api-key') return null;
  if (!containsResearchKeywords(query)) return null;

  let projects;
  try {
    projects = await listActiveProjectsForUser(userId);
  } catch (error) {
    logger.warn('Research chat augmentation skipped (DB unavailable)', { error: error.message });
    return null;
  }

  if (!projects.length) return null;

  const scored = [];
  for (const project of projects.slice(0, 5)) {
    const namespace = buildResearchNamespace(userId, project.id);
    const results = await vectorStore.search(query, 3, namespace);
    for (const result of results) {
      scored.push({ ...result, projectTitle: project.title, projectId: project.id });
    }
  }

  if (!scored.length) return null;

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 5);
  const contextText = top.map((chunk) => chunk.text).join('\n\n');
  const primaryTitle = top[0].projectTitle || projects[0].title;

  return {
    projectTitle: primaryTitle,
    contextText,
    systemPrefix: [
      `The user is working on a research paper titled "${primaryTitle}".`,
      'Relevant context from their literature database:',
      contextText,
    ].join('\n'),
  };
}

/**
 * Prepend research-aware system context to conversation history.
 * @param {Array<{ role: string, content: string }>} conversationHistory
 * @param {string} query
 * @param {number|string} userId
 * @returns {Promise<Array<{ role: string, content: string }>>}
 */
export async function applyResearchChatAugmentation(conversationHistory, query, userId) {
  const augmentation = await getResearchChatAugmentation(query, userId);
  if (!augmentation) return conversationHistory;

  const history = [...conversationHistory];
  const systemIdx = history.findIndex((message) => message.role === 'system');

  if (systemIdx >= 0) {
    history[systemIdx] = {
      ...history[systemIdx],
      content: `${augmentation.systemPrefix}\n\n${history[systemIdx].content}`,
    };
  } else {
    history.unshift({ role: 'system', content: augmentation.systemPrefix });
  }

  return history;
}
