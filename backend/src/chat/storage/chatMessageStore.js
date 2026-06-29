import {
  getStoredTurns,
  recordConversationExchange,
  resolveConversationKey,
} from '../../services/conversationSessionStore.js';

/** Chat persistence — wraps conversation session store (Postgres-backed memory is separate). */
export function resolveChatKey(userId, sessionId) {
  return resolveConversationKey(userId, sessionId);
}

export function loadChatHistory(key) {
  return getStoredTurns(key);
}

export function persistChatExchange(key, userMessage, assistantMessage) {
  recordConversationExchange(key, userMessage, assistantMessage);
}
