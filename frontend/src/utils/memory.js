/**
 * Shared chat pipeline — single source of truth for message building and memory.
 */
import { OWNAI_SYSTEM_PROMPT } from '../config/personality.js';
import ownaiMemory from './ownaiMemory.js';
import { buildThinkPrompt } from './chainOfThoughtClient.js';
import { buildRagUserPrompt, buildRagSystemMessage } from './ragPrompt.js';

export function getSessionContext(messages = []) {
  return messages
    .filter((m) => !m.streaming && m.content?.trim() && (m.role === 'user' || m.role === 'assistant'))
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.trim() }));
}

/** Merge session history with persisted memory (deduped). */
export function resolveHistory(sessionMessages = []) {
  const session = getSessionContext(sessionMessages);
  if (session.length) return session.slice(-10);
  return ownaiMemory.getHistory(10);
}

export function buildChatMessages({
  history = [],
  userPrompt = '',
  ragContext = '',
  taskMode = 'FAST MODE',
  includeMemory = true,
}) {
  const userContext = includeMemory ? ownaiMemory.buildContext() + userPrompt : userPrompt;
  const enriched = ragContext
    ? buildRagUserPrompt(userContext, ragContext)
    : userContext;

  const useCoT = !ragContext && (taskMode === 'THINK MODE' || taskMode === 'DEEP MODE');
  const finalUser = useCoT ? buildThinkPrompt(enriched) : enriched;

  const systemContent = ragContext
    ? buildRagSystemMessage(ragContext)
    : OWNAI_SYSTEM_PROMPT;

  const turns = [...history];
  const last = turns[turns.length - 1];
  if (finalUser && (!last || last.role !== 'user' || last.content !== finalUser)) {
    turns.push({ role: 'user', content: finalUser });
  }

  return [
    { role: 'system', content: systemContent },
    ...turns.slice(-6),
  ];
}

/** @deprecated Use ownaiMemory directly */
export const ConversationMemory = {
  add(role, content) { ownaiMemory.remember(role, content); },
  load() { ownaiMemory.load(); return ownaiMemory.getHistory(20); },
  clear() { ownaiMemory.clear(); },
  getContext() { return ownaiMemory.getHistory(10); },
};

export const MAX_MEMORY = 20;
export const CONTEXT_WINDOW = 10;
