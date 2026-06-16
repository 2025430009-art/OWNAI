import { isOllamaAvailable } from './ollamaClient.js';

const STORAGE_KEY = 'ownai_api_url';
const BUILT_IN = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, '') || '';
export const DEFAULT_LOCAL_API_URL = 'http://localhost:3000';

export const AI_MODES = {
  LOCAL: 'local',
  BACKEND: 'backend',
  STATIC: 'static',
};

export const MODE_LABELS = {
  [AI_MODES.LOCAL]: 'Local — Ollama',
  [AI_MODES.BACKEND]: 'Backend — OWNAI API',
  [AI_MODES.STATIC]: 'Offline — prompt engine',
};

export const BACKEND_NOT_CONNECTED_MSG =
  'Backend not connected. Chat works offline — connect a backend URL above, or run the server locally (cd backend && npm run start).';

export const SIGNIN_REQUIRES_BACKEND_MSG =
  'Sign-in requires the OWNAI backend. Connect a backend URL or run it locally: cd backend && npm run start';

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
  if (isStaticHosting() && !getApiBase()) {
    return BACKEND_NOT_CONNECTED_MSG;
  }
  return 'Backend not connected. Please run the backend server locally: cd backend && npm run start';
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
  if (!isStaticHosting()) return null;
  return 'Running on GitHub Pages (UI only). Chat works offline — connect a backend for sign-in and full AI.';
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
  const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
  const text = await response.text();
  if (text.trimStart().startsWith('<')) {
    throw new Error('Backend returned a web page instead of API data. Check the URL.');
  }
  const data = JSON.parse(text);
  if (!response.ok || !data.success) {
    throw new Error('Backend health check failed');
  }
  return data;
}

export async function canReachBackend() {
  if (!hasBackendConfigured()) return false;
  try {
    await probeBackend();
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect best available AI mode: Ollama → backend → static prompt engine.
 */
export async function detectAIMode() {
  if (isLocalDev() && await isOllamaAvailable()) {
    return AI_MODES.LOCAL;
  }
  if (await canReachBackend()) {
    return AI_MODES.BACKEND;
  }
  return AI_MODES.STATIC;
}

export function getModeLabel(mode) {
  return MODE_LABELS[mode] || MODE_LABELS[AI_MODES.STATIC];
}

/** User-friendly error — never expose raw HTTP codes */
export function friendlyAIError(error) {
  const msg = error?.message || '';
  if (/405|404|502|503|failed to fetch|network/i.test(msg)) {
    return getBackendUnavailableMessage();
  }
  if (/ollama/i.test(msg)) {
    return 'Ollama is not running. Start it with: ollama serve';
  }
  if (/backend|health|not connected/i.test(msg)) {
    return getBackendUnavailableMessage();
  }
  return msg.replace(/^Request failed: \d+\s*/i, '') || 'Something went wrong. Please try again.';
}
