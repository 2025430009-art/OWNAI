import { isOllamaAvailable } from './ollamaClient.js';

const STORAGE_KEY = 'ownai_api_url';
const BUILT_IN = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, '') || '';

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

export function getApiBase() {
  if (BUILT_IN) return BUILT_IN;
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY);
    return normalizeApiUrl(stored);
  }
  return '';
}

/** Alias used by architecture spec */
export function getBackendUrl() {
  return getApiBase();
}

export function setApiBase(url) {
  const normalized = normalizeApiUrl(url);
  if (!normalized) {
    throw new Error('Enter a valid http or https URL (e.g. http://localhost:3001)');
  }
  localStorage.setItem(STORAGE_KEY, normalized);
  return normalized;
}

export function clearApiBase() {
  localStorage.removeItem(STORAGE_KEY);
}

export function isLocalDev() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

export function isStaticHosting() {
  if (getApiBase()) return false;
  if (typeof window === 'undefined') return false;
  return window.location.hostname.endsWith('github.io');
}

export function getApiStatusMessage() {
  if (!isStaticHosting()) return null;
  return 'Running in offline mode. Connect a backend for full AI, or chat now with the built-in prompt engine.';
}

export function healthUrl(base = getApiBase()) {
  return base ? `${base}/api/v1/health` : '/api/v1/health';
}

export async function probeBackend(baseUrl = getApiBase()) {
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
    return 'AI service is unavailable right now. Trying offline mode or check your connection.';
  }
  if (/ollama/i.test(msg)) {
    return 'Ollama is not running. Start it with: ollama serve';
  }
  if (/backend|health/i.test(msg)) {
    return 'Backend is not reachable. Start it with: cd backend && npm run start';
  }
  return msg.replace(/^Request failed: \d+\s*/i, '') || 'Something went wrong. Please try again.';
}
