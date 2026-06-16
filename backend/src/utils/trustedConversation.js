import {
  getStoredTurns,
  isValidSessionId,
  recordConversationExchange,
  resolveConversationKey,
} from '../services/conversationSessionStore.js';

const MAX_CLIENT_TURNS = 10;
const MAX_CONTENT_LENGTH = 16000;

const BLOCKED_CONTEXT_KEYS = new Set([
  'userId',
  'user_id',
  'messages',
  'conversation_history',
  'conversationHistory',
  'memoryPrefix',
  'memory_prefix',
  '_serverTurns',
]);

/**
 * Strictly validate client-supplied turns (fallback when no session_id).
 */
export function sanitizeClientTurns(rawTurns) {
  if (!Array.isArray(rawTurns)) return [];

  const turns = [];
  for (const turn of rawTurns) {
    if (!turn || typeof turn !== 'object') continue;
    if (turn.role !== 'user' && turn.role !== 'assistant') continue;
    const content = String(turn.content || '').trim();
    if (!content || content.length > MAX_CONTENT_LENGTH) continue;
    turns.push({ role: turn.role, content });
    if (turns.length >= MAX_CLIENT_TURNS) break;
  }
  return turns;
}

/**
 * Keep only server-controlled context fields from the client payload.
 */
export function stripUnsafeContext(context = {}) {
  if (!context || typeof context !== 'object' || Array.isArray(context)) return {};
  const safe = {};
  for (const [key, value] of Object.entries(context)) {
    if (BLOCKED_CONTEXT_KEYS.has(key)) continue;
    if (key === 'score_confidence' && typeof value === 'boolean') {
      safe.score_confidence = value;
    }
  }
  return safe;
}

/**
 * Resolve conversation turns: prefer server store when session_id is present.
 */
export function resolveTrustedTurns({ userId, sessionId, context = {}, message }) {
  const safeContext = stripUnsafeContext(context);
  const sessionKey = isValidSessionId(sessionId)
    ? resolveConversationKey(userId, sessionId)
    : null;

  let turns;
  if (sessionKey) {
    turns = getStoredTurns(sessionKey);
  } else {
    const clientTurns = context.messages || context.conversation_history || context.conversationHistory;
    turns = sanitizeClientTurns(clientTurns);
  }

  return {
    turns,
    sessionKey,
    safeContext,
    sessionId: isValidSessionId(sessionId) ? sessionId : null,
  };
}

export function persistTrustedExchange(sessionKey, userMessage, assistantMessage) {
  recordConversationExchange(sessionKey, userMessage, assistantMessage);
}
