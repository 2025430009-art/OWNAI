const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_TURNS = 10;
const TTL_MS = 24 * 60 * 60 * 1000;

/** @type {Map<string, { turns: Array<{role: string, content: string}>, updatedAt: number }>} */
const store = new Map();

export function isValidSessionId(sessionId) {
  return typeof sessionId === 'string' && UUID_V4_REGEX.test(sessionId);
}

/**
 * Namespace server-side history by authenticated user + client session id.
 */
export function resolveConversationKey(userId, sessionId) {
  if (!isValidSessionId(sessionId)) return null;
  const owner = userId != null ? `u:${userId}` : 'anon';
  return `${owner}:${sessionId}`;
}

function pruneExpired() {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now - entry.updatedAt > TTL_MS) store.delete(key);
  }
}

export function getStoredTurns(key) {
  if (!key) return [];
  pruneExpired();
  const entry = store.get(key);
  if (!entry) return [];
  return entry.turns.slice(-MAX_TURNS);
}

export function recordConversationExchange(key, userMessage, assistantMessage) {
  if (!key) return;
  const user = String(userMessage || '').trim();
  const assistant = String(assistantMessage || '').trim();
  if (!user || !assistant) return;

  pruneExpired();
  const entry = store.get(key) || { turns: [], updatedAt: Date.now() };
  entry.turns.push({ role: 'user', content: user });
  entry.turns.push({ role: 'assistant', content: assistant });
  entry.turns = entry.turns.slice(-MAX_TURNS);
  entry.updatedAt = Date.now();
  store.set(key, entry);
}

/** Test helper */
export function clearConversationStore() {
  store.clear();
}
