import { isOllamaAvailable } from './ollamaClient.js';
import { hasAnthropicDirect } from './anthropicDirect.js';

const STORAGE_KEY = 'ownai_api_url';
export const DEFAULT_LOCAL_API_URL = 'http://localhost:3000';

export function normalizeApiUrl(url) {
  const trimmed = url?.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    return parsed.origin.replace(/\/$/, '');
  } catch {
    return '';
  }
}

const BUILT_IN = normalizeApiUrl(import.meta.env.VITE_API_URL) || '';

export const AI_MODES = {
  LOCAL: 'local',
  BACKEND: 'backend',
  CLOUD: 'cloud',
  STATIC: 'static',
};

export const MODE_LABELS = {
  [AI_MODES.LOCAL]: 'Local — Ollama',
  [AI_MODES.BACKEND]: 'Backend — OWNAI API',
  [AI_MODES.CLOUD]: 'Cloud — OWNAI',
  [AI_MODES.STATIC]: 'OWNAI',
};

export const USER_UNAVAILABLE_MSG =
  'OWNAI is currently starting up. Please try again in a moment.';

export const BACKEND_NOT_CONNECTED_MSG = USER_UNAVAILABLE_MSG;

export const SIGNIN_REQUIRES_BACKEND_MSG =
  'Sign-in is temporarily unavailable. Please try again in a moment.';

export function isLocalDev() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

/**
 * Resolved backend origin.
 * Priority: VITE_API_URL → localStorage → Vite dev proxy (relative URLs) → localhost default.
 */
export function getApiBase() {
  if (BUILT_IN) return BUILT_IN;
  if (typeof window !== 'undefined') {
    let stored = normalizeApiUrl(localStorage.getItem(STORAGE_KEY));
    // In Vite dev, ignore stale http://localhost:3000 — backend may bind another port
    if (stored && import.meta.env?.DEV && stored === DEFAULT_LOCAL_API_URL) {
      stored = '';
    }
    if (stored) return stored;
  }
  // Vite dev: same-origin /api requests go through vite.config.js proxy
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV && isLocalDev()) {
    return '';
  }
  if (isLocalDev()) return DEFAULT_LOCAL_API_URL;
  return '';
}

export function hasBackendConfigured() {
  const base = getApiBase();
  if (base) return true;
  return typeof import.meta !== 'undefined' && import.meta.env?.DEV && isLocalDev();
}

/** Build a full API URL or throw if no backend is configured (e.g. GitHub Pages). */
export function apiUrl(path) {
  const base = getApiBase();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (!base) {
    if (hasBackendConfigured()) return normalizedPath;
    throw new Error(getBackendUnavailableMessage());
  }
  return `${base}${normalizedPath}`;
}

export function getBackendUnavailableMessage() {
  return USER_UNAVAILABLE_MSG;
}

/** Alias used by architecture spec */
export function getBackendUrl() {
  return getApiBase();
}

export function setApiBase(url) {
  const normalized = normalizeApiUrl(url);
  if (!normalized) {
    throw new Error('Enter a valid http or https URL (e.g. http://localhost:3000)');
  }
  localStorage.setItem(STORAGE_KEY, normalized);
  return normalized;
}

export function clearApiBase() {
  localStorage.removeItem(STORAGE_KEY);
}

export function isStaticHosting() {
  if (getApiBase() && getApiBase() !== DEFAULT_LOCAL_API_URL) return false;
  if (BUILT_IN) return false;
  if (typeof window === 'undefined') return false;
  if (typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY)) return false;
  return window.location.hostname.endsWith('github.io');
}

export function getApiStatusMessage() {
  return null;
}

export function healthUrl(base = getApiBase()) {
  if (!base) return '/api/v1/health';
  return `${base}/api/v1/health`;
}

/**
 * WebSocket origin for real-time streams (e.g. PromptToVideo progress).
 * Uses Vite dev proxy (same host) when API base is relative.
 */
export function getWebSocketBase() {
  const base = getApiBase();
  if (base) return base.replace(/^http/, 'ws');
  if (typeof window !== 'undefined' && hasBackendConfigured()) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}`;
  }
  return '';
}

export function wsUrl(path, params = {}) {
  const wsBase = getWebSocketBase();
  if (!wsBase) return null;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const qs = new URLSearchParams(params).toString();
  return `${wsBase}${normalizedPath}${qs ? `?${qs}` : ''}`;
}

export async function probeBackend(baseUrl = getApiBase()) {
  if (!baseUrl && !hasBackendConfigured()) {
    throw new Error(getBackendUnavailableMessage());
  }
  const url = baseUrl ? `${baseUrl}/api/v1/health` : '/api/v1/health';
  const isRemote = baseUrl && !/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(baseUrl);
  const timeoutMs = isRemote ? 60000 : 4000;

  let response;
  let text;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    text = await response.text();
  } catch {
    throw new Error(USER_UNAVAILABLE_MSG);
  }

  if (!response.ok && text.trim() === 'Not Found') {
    throw new Error(USER_UNAVAILABLE_MSG);
  }

  if (text.trimStart().startsWith('<')) {
    throw new Error(USER_UNAVAILABLE_MSG);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(USER_UNAVAILABLE_MSG);
  }

  if (!response.ok || !data.success) {
    throw new Error(USER_UNAVAILABLE_MSG);
  }
  return data;
}

/** Quiet health ping — no user-facing errors. */
async function pingBackend(baseUrl = getApiBase()) {
  if (!baseUrl && !hasBackendConfigured()) return false;
  const url = baseUrl ? `${baseUrl}/api/v1/health` : '/api/v1/health';
  const isRemote = baseUrl && !/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(baseUrl);
  const timeoutMs = isRemote ? 60000 : 4000;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return false;
    const data = await response.json();
    return data.success === true;
  } catch {
    return false;
  }
}

export async function canReachBackend(retries = 3) {
  if (!hasBackendConfigured()) return false;

  for (let attempt = 0; attempt < retries; attempt += 1) {
    if (await pingBackend(getApiBase())) return true;
    if (attempt < retries - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  return false;
}

/**
 * Detect best available AI mode: backend → Ollama (local dev) → Anthropic direct → static.
 */
export async function detectAIMode() {
  if (await canReachBackend(3)) {
    return AI_MODES.BACKEND;
  }
  if (isLocalDev() && await isOllamaAvailable()) {
    return AI_MODES.LOCAL;
  }
  if (hasAnthropicDirect()) {
    return AI_MODES.CLOUD;
  }
  return AI_MODES.STATIC;
}

export function getModeLabel(mode) {
  return MODE_LABELS[mode] || MODE_LABELS[AI_MODES.STATIC];
}

/** User-friendly error — never expose dev instructions or raw HTTP codes */
export function friendlyAIError(error) {
  const msg = error?.message || '';
  if (/authentication required|401|invalid or expired token/i.test(msg)) {
    return USER_UNAVAILABLE_MSG;
  }
  if (/405|404|502|503|failed to fetch|network|backend|health|not connected|unreachable|timed out|ollama/i.test(msg)) {
    return USER_UNAVAILABLE_MSG;
  }
  if (/cd backend|npm start|install ollama|offline mode|connect the ownai backend/i.test(msg)) {
    return USER_UNAVAILABLE_MSG;
  }
  const cleaned = msg.replace(/^Request failed: \d+\s*/i, '').trim();
  return cleaned || USER_UNAVAILABLE_MSG;
}
