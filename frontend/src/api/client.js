const API_BASE = import.meta.env.VITE_API_URL || '';

const STATIC_HOSTING_MESSAGE =
  'Chat and sign-in require the OWNAI backend. GitHub Pages hosts the UI only — run the backend locally (cd backend && npm run start) and the frontend (cd frontend && npm run dev), then open http://localhost:5173.';

export function isStaticHosting() {
  if (import.meta.env.VITE_API_URL) return false;
  if (typeof window === 'undefined') return false;
  return window.location.hostname.endsWith('github.io');
}

export function getApiStatusMessage() {
  return isStaticHosting() ? STATIC_HOSTING_MESSAGE : null;
}

function requireBackend() {
  if (isStaticHosting()) {
    throw new Error(STATIC_HOSTING_MESSAGE);
  }
}

function throwApiError(response, error = {}) {
  if (isStaticHosting() && [404, 405, 502, 503].includes(response.status)) {
    throw new Error(STATIC_HOSTING_MESSAGE);
  }
  throw new Error(error.error || error.message || `Request failed: ${response.status}`);
}

async function parseJsonResponse(response) {
  const text = await response.text();
  const trimmed = text.trimStart();
  if (trimmed.startsWith('<!') || trimmed.startsWith('<html')) {
    throw new Error(STATIC_HOSTING_MESSAGE);
  }
  if (!trimmed) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      isStaticHosting()
        ? STATIC_HOSTING_MESSAGE
        : 'Invalid response from server. Make sure the OWNAI backend is running (npm run start).',
    );
  }
}

function getToken() {
  return localStorage.getItem('ownai_token');
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function generateText({ prompt, max_tokens, temperature, model_key, algorithm_id, stream }) {
  requireBackend();
  const response = await fetch(`${API_BASE}/api/v1/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ prompt, max_tokens, temperature, model_key, algorithm_id, stream }),
  });

  if (!response.ok) {
    const error = await parseJsonResponse(response).catch(() => ({}));
    throwApiError(response, error);
  }

  if (stream) {
    return response;
  }

  return parseJsonResponse(response);
}

export async function signup(email, password) {
  const response = await fetch(`${API_BASE}/api/v1/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Signup failed');
  return data;
}

export async function login(email, password) {
  const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Login failed');
  return data;
}

export async function getMe() {
  const response = await fetch(`${API_BASE}/api/v1/auth/me`, {
    headers: authHeaders(),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Failed to fetch profile');
  return data;
}

export async function listModels() {
  const response = await fetch(`${API_BASE}/api/v1/models`);
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Failed to list models');
  return data;
}

export async function healthCheck() {
  if (isStaticHosting()) {
    throw new Error('offline');
  }
  const response = await fetch(`${API_BASE}/api/v1/health`);
  const data = await parseJsonResponse(response);
  if (!response.ok || !data.success) throw new Error('offline');
  return data;
}

export async function listCapabilities() {
  const response = await fetch(`${API_BASE}/api/v1/capabilities`);
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Failed to list capabilities');
  return data;
}

export async function executeCapability(slug, payload) {
  const response = await fetch(`${API_BASE}/api/v1/capabilities/${slug}/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.error || data.hint || `Capability failed: ${response.status}`);
  }
  return data;
}

export async function listCodeGenerators() {
  const response = await fetch(`${API_BASE}/api/v1/code-generators`);
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Failed to list code generators');
  return data;
}

export async function generateCode({
  generatorId,
  prompt,
  max_tokens,
  temperature,
  model_key,
  stream,
}) {
  requireBackend();
  const response = await fetch(`${API_BASE}/api/v1/code-generators/${generatorId}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ prompt, max_tokens, temperature, model_key, stream }),
  });

  if (!response.ok) {
    const error = await parseJsonResponse(response).catch(() => ({}));
    throwApiError(response, error);
  }

  if (stream) return response;
  return parseJsonResponse(response);
}

export async function uploadAttachments(files, sessionId) {
  requireBackend();
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  if (sessionId) formData.append('session_id', sessionId);

  const response = await fetch(`${API_BASE}/api/v1/attachments`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Upload failed');
  return data;
}

export async function deleteAttachment(id) {
  const response = await fetch(`${API_BASE}/api/v1/attachments/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Delete failed');
  return data;
}

export async function listAIEngines() {
  const response = await fetch(`${API_BASE}/api/v1/algorithms/engines`);
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Failed to list AI engines');
  return data;
}

export async function listAlgorithms() {
  const response = await fetch(`${API_BASE}/api/v1/algorithms`);
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Failed to list algorithms');
  return data;
}

export async function chatWithAttachments({
  prompt,
  attachmentIds = [],
  files = [],
  sessionId,
  max_tokens,
  temperature,
  model_key,
  algorithm_id,
  stream = true,
}) {
  requireBackend();
  const formData = new FormData();
  formData.append('prompt', prompt);
  formData.append('stream', String(stream));
  if (sessionId) formData.append('session_id', sessionId);
  if (max_tokens) formData.append('max_tokens', String(max_tokens));
  if (temperature !== undefined) formData.append('temperature', String(temperature));
  if (model_key) formData.append('model_key', model_key);
  if (algorithm_id) formData.append('algorithm_id', algorithm_id);
  if (attachmentIds.length) {
    formData.append('attachment_ids', JSON.stringify(attachmentIds));
  }
  for (const file of files) {
    formData.append('files', file);
  }

  const response = await fetch(`${API_BASE}/api/v1/attachments/chat`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });

  if (!response.ok) {
    const error = await parseJsonResponse(response).catch(() => ({}));
    throwApiError(response, error);
  }

  if (stream) return response;
  return parseJsonResponse(response);
}

export async function saveOwnAIQa({ question, answer, topic, source }) {
  const response = await fetch(`${API_BASE}/api/v1/ownai-qa`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ question, answer, topic, source }),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Failed to save Q&A');
  return data;
}

export async function listOwnAIQa({ topic } = {}) {
  const params = new URLSearchParams();
  if (topic) params.set('topic', topic);
  const qs = params.toString();
  const response = await fetch(`${API_BASE}/api/v1/ownai-qa${qs ? `?${qs}` : ''}`);
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Failed to load reference');
  return data;
}

export async function searchOwnAIQa(q) {
  const response = await fetch(`${API_BASE}/api/v1/ownai-qa/search?q=${encodeURIComponent(q)}`);
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Search failed');
  return data;
}

export async function deleteOwnAIQa(id) {
  const response = await fetch(`${API_BASE}/api/v1/ownai-qa/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Delete failed');
  return data;
}

function codeLibraryQuery(params = {}) {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.lang) qs.set('lang', params.lang);
  if (params.type) qs.set('type', params.type);
  if (params.sort) qs.set('sort', params.sort);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export async function saveCodeLibraryEntry(entry) {
  const response = await fetch(`${API_BASE}/api/v1/code-library`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(entry),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Failed to save code entry');
  return data;
}

export async function listCodeLibrary(params = {}) {
  const response = await fetch(`${API_BASE}/api/v1/code-library${codeLibraryQuery(params)}`);
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Failed to load code library');
  return data;
}

export async function getCodeLibraryEntry(id) {
  const response = await fetch(`${API_BASE}/api/v1/code-library/${id}`);
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Entry not found');
  return data;
}

export async function updateCodeLibraryEntry(id, entry) {
  const response = await fetch(`${API_BASE}/api/v1/code-library/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(entry),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Failed to update entry');
  return data;
}

export async function deleteCodeLibraryEntry(id) {
  const response = await fetch(`${API_BASE}/api/v1/code-library/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Delete failed');
  return data;
}

export async function searchCodeLibrary(q, params = {}) {
  const qs = new URLSearchParams({ q });
  if (params.lang) qs.set('lang', params.lang);
  if (params.type) qs.set('type', params.type);
  if (params.sort) qs.set('sort', params.sort);
  const response = await fetch(`${API_BASE}/api/v1/code-library/search?${qs}`);
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Search failed');
  return data;
}

export async function filterCodeLibrary(params = {}) {
  const response = await fetch(`${API_BASE}/api/v1/code-library/filter${codeLibraryQuery(params)}`);
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Filter failed');
  return data;
}
