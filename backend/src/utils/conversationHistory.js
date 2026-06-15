import { OWNAI_SYSTEM_PROMPT } from '../config/personality.js';

const MAX_TURNS = 10;

/**
 * Build QVAC/Ollama-compatible message history with system prompt + prior turns.
 * @param {Array<{role: string, content: string}>} messages
 * @param {string} latestUserPrompt - current user message (if not already last in messages)
 */
export function buildConversationHistory(messages = [], latestUserPrompt = '') {
  const turns = messages
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content?.trim())
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, content: m.content.trim() }));

  const last = turns[turns.length - 1];
  if (latestUserPrompt && (!last || last.role !== 'user' || last.content !== latestUserPrompt.trim())) {
    turns.push({ role: 'user', content: latestUserPrompt.trim() });
  }

  if (!turns.length && latestUserPrompt) {
    turns.push({ role: 'user', content: latestUserPrompt.trim() });
  }

  return [
    { role: 'system', content: OWNAI_SYSTEM_PROMPT },
    ...turns,
  ];
}
