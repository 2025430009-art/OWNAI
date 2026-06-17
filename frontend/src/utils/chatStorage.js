/**
 * Chat session persistence — localStorage now, swappable to backend later.
 */

const SESSIONS_KEY = 'ownai_chat_sessions';
const ACTIVE_SESSION_KEY = 'ownai_active_chat_id';

/** @typedef {'user' | 'assistant' | 'system'} ChatRole */
/** @typedef {{ role: ChatRole, content: string, timestamp: string, streaming?: boolean, [key: string]: unknown }} ChatMessage */
/** @typedef {{ id: string, title: string, section?: string, createdAt: string, updatedAt: string, messages: ChatMessage[] }} ChatSession */

function nowIso() {
  return new Date().toISOString();
}

/** @param {ChatSession} chat */
export function saveChat(chat) {
  const all = loadSessions();
  const idx = all.findIndex((c) => c.id === chat.id);
  const next = idx >= 0
    ? all.map((c, i) => (i === idx ? normalizeSession(chat) : c))
    : [normalizeSession(chat), ...all];
  saveSessions(next);
}

/** @returns {ChatSession[]} */
export function getAllChats() {
  return loadSessions();
}

/**
 * @param {string} firstMessage
 * @returns {ChatSession}
 */
export function createChat(firstMessage = '') {
  const session = createEmptySession('chat');
  if (firstMessage.trim()) {
    session.title = titleFromFirstMessage(firstMessage);
  }
  return session;
}

/** @param {string} id */
export function deleteChat(id) {
  const all = loadSessions().filter((c) => c.id !== id);
  saveSessions(all);
}

/**
 * Group chats for sidebar — Today, Yesterday, This Week, Older.
 * @param {ChatSession[]} chats
 */
export function groupChatsByDate(chats) {
  const now = new Date();
  const groups = { Today: [], Yesterday: [], 'This Week': [], Older: [] };

  chats
    .filter((c) => !c.section || c.section === 'chat')
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .forEach((chat) => {
      const d = new Date(chat.updatedAt);
      const diffDays = Math.floor((startOfDay(now) - startOfDay(d)) / 86400000);
      if (diffDays === 0) groups.Today.push(chat);
      else if (diffDays === 1) groups.Yesterday.push(chat);
      else if (diffDays < 7) groups['This Week'].push(chat);
      else groups.Older.push(chat);
    });

  return Object.fromEntries(
    Object.entries(groups).filter(([, list]) => list.length > 0),
  );
}

export function createSessionId() {
  return crypto.randomUUID();
}

/**
 * Auto-title from first 5–6 words of the first user message.
 * @param {string} text
 */
export function titleFromFirstMessage(text) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'New conversation';
  const title = words.slice(0, 6).join(' ');
  return title.length > 52 ? `${title.slice(0, 52)}…` : title;
}

/**
 * @param {string} [section]
 * @returns {ChatSession}
 */
export function createEmptySession(section = 'chat') {
  const ts = nowIso();
  return {
    id: createSessionId(),
    title: 'New conversation',
    section,
    createdAt: ts,
    updatedAt: ts,
    messages: [],
  };
}

function normalizeTimestamp(value) {
  if (!value) return nowIso();
  if (typeof value === 'number') return new Date(value).toISOString();
  return value;
}

/**
 * @param {unknown} raw
 * @returns {ChatSession}
 */
function normalizeSession(raw) {
  const session = /** @type {ChatSession} */ (raw);
  return {
    id: session.id || createSessionId(),
    title: session.title || 'New conversation',
    section: session.section || 'chat',
    createdAt: normalizeTimestamp(session.createdAt),
    updatedAt: normalizeTimestamp(session.updatedAt),
    messages: (session.messages || []).map((m) => ({
      ...m,
      role: m.role || 'user',
      content: m.content || '',
      timestamp: normalizeTimestamp(m.timestamp),
    })),
  };
}

/** @returns {ChatSession[]} */
export function loadSessions() {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeSession);
  } catch {
    return [];
  }
}

/** @param {ChatSession[]} sessions */
export function saveSessions(sessions) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function loadActiveSessionId() {
  try {
    return localStorage.getItem(ACTIVE_SESSION_KEY);
  } catch {
    return null;
  }
}

/** @param {string|null} id */
export function saveActiveSessionId(id) {
  if (id) localStorage.setItem(ACTIVE_SESSION_KEY, id);
  else localStorage.removeItem(ACTIVE_SESSION_KEY);
}

/**
 * Backend-ready loader — swap implementation when API exists.
 * @returns {Promise<ChatSession[]>}
 */
export async function loadSessionsAsync() {
  return loadSessions();
}

/**
 * @param {ChatSession[]} sessions
 * @returns {Promise<void>}
 */
export async function saveSessionsAsync(sessions) {
  saveSessions(sessions);
}

/**
 * @param {ChatSession} session
 * @returns {string}
 */
export function getFirstMessagePreview(session) {
  const firstUser = session.messages.find((m) => m.role === 'user' && m.content?.trim());
  if (!firstUser) return 'No messages yet';
  const text = firstUser.content.trim();
  return text.length > 72 ? `${text.slice(0, 72)}…` : text;
}

/**
 * @param {string} iso
 */
export function formatSessionTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function startOfDay(d) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/**
 * @param {string} iso
 * @returns {'today' | 'yesterday' | 'last7' | 'older'}
 */
export function dateBucket(iso) {
  const date = new Date(iso);
  const today = startOfDay(new Date());
  const target = startOfDay(date);
  const diffDays = Math.floor((today - target) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays <= 7) return 'last7';
  return 'older';
}

const BUCKET_LABELS = {
  today: 'Today',
  yesterday: 'Yesterday',
  last7: 'Last 7 days',
  older: 'Older',
};

const BUCKET_ORDER = ['today', 'yesterday', 'last7', 'older'];

/**
 * @param {ChatSession[]} sessions
 * @returns {{ bucket: string, label: string, sessions: ChatSession[] }[]}
 */
export function groupSessionsByDate(sessions) {
  const chatSessions = sessions
    .filter((s) => !s.section || s.section === 'chat')
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  const buckets = Object.fromEntries(BUCKET_ORDER.map((k) => [k, []]));

  for (const session of chatSessions) {
    buckets[dateBucket(session.updatedAt)].push(session);
  }

  return BUCKET_ORDER
    .filter((key) => buckets[key].length > 0)
    .map((key) => ({
      bucket: key,
      label: BUCKET_LABELS[key],
      sessions: buckets[key],
    }));
}

/**
 * @param {ChatSession[]} sessions
 * @param {string} query
 */
export function searchSessions(sessions, query) {
  const q = query.trim().toLowerCase();
  if (!q) return sessions;

  return sessions.filter((session) => {
    if (session.title.toLowerCase().includes(q)) return true;
    return session.messages.some((m) => m.content?.toLowerCase().includes(q));
  });
}

/**
 * @param {ChatMessage} message
 */
export function withMessageTimestamp(message) {
  return {
    ...message,
    timestamp: message.timestamp || nowIso(),
  };
}
