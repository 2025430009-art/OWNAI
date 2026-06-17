import {
  apiUrl,
  getApiBase,
  hasBackendConfigured,
  isStaticHosting,
  getApiStatusMessage,
  getBackendUnavailableMessage,
  probeBackend,
  SIGNIN_REQUIRES_BACKEND_MSG,
} from '../utils/apiConfig.js';

export {
  isStaticHosting,
  getApiStatusMessage,
  getApiBase,
  hasBackendConfigured,
  getBackendUnavailableMessage,
} from '../utils/apiConfig.js';

function requireBackend() {
  if (!hasBackendConfigured()) {
    throw new Error(getBackendUnavailableMessage());
  }
}

function throwApiError(response, error = {}) {
  if ([404, 405, 502, 503].includes(response.status)) {
    throw new Error(getBackendUnavailableMessage());
  }
  const fallback = error.error || error.message;
  if (fallback) throw new Error(fallback);
  throw new Error(getBackendUnavailableMessage());
}

async function parseJsonResponse(response) {
  const text = await response.text();
  const trimmed = text.trimStart();
  if (trimmed.startsWith('<!') || trimmed.startsWith('<html')) {
    throw new Error(getBackendUnavailableMessage());
  }
  if (!trimmed) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(getBackendUnavailableMessage());
  }
}

function apiFetch(path, options = {}) {
  return fetch(apiUrl(path), {
    credentials: 'include',
    ...options,
  });
}

export async function generateText({
  prompt,
  messages,
  max_tokens,
  temperature,
  model_key,
  algorithm_id,
  stream,
  use_rag,
  reasoning_mode,
  enable_thinking,
}) {
  const response = await apiFetch('/api/v1/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      messages,
      max_tokens,
      temperature,
      model_key,
      algorithm_id,
      stream: stream !== false,
      use_rag,
      reasoning_mode,
      enable_thinking,
    }),
  });

  if (!response.ok) {
    const error = await parseJsonResponse(response).catch(() => ({}));
    throwApiError(response, error);
  }

  if (stream) return response;
  return parseJsonResponse(response);
}

export async function queryRag(question, top_k = 3) {
  const response = await apiFetch('/api/v1/rag/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ question, top_k }),
  });
  if (!response.ok) {
    const error = await parseJsonResponse(response).catch(() => ({}));
    throwApiError(response, error);
  }
  return parseJsonResponse(response);
}

export async function ingestRagDocument(file) {
  requireBackend();
  const form = new FormData();
  form.append('file', file);
  const response = await apiFetch('/api/v1/rag/ingest', {
    method: 'POST',
    body: form,
  });
  if (!response.ok) {
    const error = await parseJsonResponse(response).catch(() => ({}));
    throwApiError(response, error);
  }
  return parseJsonResponse(response);
}

export async function uploadDocument(file) {
  requireBackend();
  const form = new FormData();
  form.append('file', file);
  const response = await apiFetch('/api/v1/documents/upload', {
    method: 'POST',
    body: form,
  });
  if (!response.ok) {
    const error = await parseJsonResponse(response).catch(() => ({}));
    throwApiError(response, error);
  }
  return parseJsonResponse(response);
}

export async function listUploadedDocuments() {
  const response = await apiFetch('/api/v1/documents');
  if (!response.ok) {
    const error = await parseJsonResponse(response).catch(() => ({}));
    throwApiError(response, error);
  }
  return parseJsonResponse(response);
}

export async function getRagStatus() {
  const response = await apiFetch('/api/v1/rag/status');
  if (!response.ok) {
    const error = await parseJsonResponse(response).catch(() => ({}));
    throwApiError(response, error);
  }
  return parseJsonResponse(response);
}

export async function signup(email, password) {
  if (!hasBackendConfigured()) {
    throw new Error(SIGNIN_REQUIRES_BACKEND_MSG);
  }
  const response = await apiFetch('/api/v1/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Signup failed');
  return data;
}

export async function login(email, password) {
  if (!hasBackendConfigured()) {
    throw new Error(SIGNIN_REQUIRES_BACKEND_MSG);
  }
  const response = await apiFetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Login failed');
  return data;
}

export async function logout() {
  if (!hasBackendConfigured()) return { success: true };
  const response = await apiFetch('/api/v1/auth/logout', { method: 'POST' });
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Logout failed');
  return data;
}

export async function getMe() {
  if (!hasBackendConfigured()) return { user: null };
  const response = await apiFetch('/api/v1/auth/me');
  if (response.status === 401) return { user: null };
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Failed to fetch profile');
  return data;
}

export async function listModels() {
  if (!hasBackendConfigured()) return { available: [] };
  const response = await apiFetch('/api/v1/models');
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Failed to list models');
  return data;
}

export async function healthCheck() {
  if (!hasBackendConfigured()) {
    throw new Error('offline');
  }
  return probeBackend(getApiBase());
}

export async function listCapabilities() {
  if (!hasBackendConfigured()) return { capabilities: [] };
  const response = await apiFetch('/api/v1/capabilities');
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Failed to list capabilities');
  return data;
}

export async function executeCapability(slug, payload) {
  const response = await apiFetch(`/api/v1/capabilities/${slug}/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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
  if (!hasBackendConfigured()) return { generators: [] };
  const response = await apiFetch('/api/v1/code-generators');
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
  const response = await apiFetch(`/api/v1/code-generators/${generatorId}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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

  const response = await apiFetch('/api/v1/attachments', {
    method: 'POST',
    body: formData,
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Upload failed');
  return data;
}

export async function deleteAttachment(id) {
  const response = await apiFetch(`/api/v1/attachments/${id}`, {
    method: 'DELETE',
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Delete failed');
  return data;
}

export async function listAIEngines() {
  if (!hasBackendConfigured()) return { engines: [] };
  const response = await apiFetch('/api/v1/algorithms/engines');
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Failed to list AI engines');
  return data;
}

export async function listAlgorithms() {
  if (!hasBackendConfigured()) return { algorithms: [] };
  const response = await apiFetch('/api/v1/algorithms');
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

  const response = await apiFetch('/api/v1/attachments/chat', {
    method: 'POST',
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
  const response = await apiFetch('/api/v1/ownai-qa', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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
  const response = await apiFetch(`/api/v1/ownai-qa${qs ? `?${qs}` : ''}`);
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Failed to load reference');
  return data;
}

export async function searchOwnAIQa(q) {
  const response = await apiFetch(`/api/v1/ownai-qa/search?q=${encodeURIComponent(q)}`);
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Search failed');
  return data;
}

export async function deleteOwnAIQa(id) {
  const response = await apiFetch(`/api/v1/ownai-qa/${id}`, {
    method: 'DELETE',
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
  const response = await apiFetch('/api/v1/code-library', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Failed to save code entry');
  return data;
}

export async function listCodeLibrary(params = {}) {
  const response = await apiFetch(`/api/v1/code-library${codeLibraryQuery(params)}`);
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Failed to load code library');
  return data;
}

export async function getCodeLibraryEntry(id) {
  const response = await apiFetch(`/api/v1/code-library/${id}`);
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Entry not found');
  return data;
}

export async function updateCodeLibraryEntry(id, entry) {
  const response = await apiFetch(`/api/v1/code-library/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Failed to update entry');
  return data;
}

export async function deleteCodeLibraryEntry(id) {
  const response = await apiFetch(`/api/v1/code-library/${id}`, {
    method: 'DELETE',
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
  const response = await apiFetch(`/api/v1/code-library/search?${qs}`);
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Search failed');
  return data;
}

export async function filterCodeLibrary(params = {}) {
  const response = await apiFetch(`/api/v1/code-library/filter${codeLibraryQuery(params)}`);
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Filter failed');
  return data;
}

// --- AI Thinking Engine ---

export async function thinkMessage({
  message,
  mode = 'auto',
  sessionId,
  context = {},
  tools = [],
  stream = true,
  use_extended_thinking = false,
}) {
  requireBackend();
  const response = await apiFetch('/api/v1/think', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      mode,
      session_id: sessionId,
      context,
      tools,
      stream: stream !== false,
      use_extended_thinking,
    }),
  });

  if (!response.ok) {
    const error = await parseJsonResponse(response).catch(() => ({}));
    throwApiError(response, error);
  }

  if (stream) return response;
  return parseJsonResponse(response);
}

export async function detectThinkingMode(message, context = {}) {
  requireBackend();
  const response = await apiFetch('/api/v1/think/detect-mode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, context }),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Mode detection failed');
  return data;
}

export async function compareThinkingModes(message, modes, { sessionId, context = {} } = {}) {
  requireBackend();
  const response = await apiFetch('/api/v1/think/compare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      modes,
      session_id: sessionId,
      context,
    }),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Compare failed');
  return data;
}

export async function listMemories(type) {
  requireBackend();
  const qs = type ? `?type=${encodeURIComponent(type)}` : '';
  const response = await apiFetch(`/api/v1/think/memory${qs}`);
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Failed to load memories');
  return data;
}

export async function saveMemoryEntry(entry) {
  requireBackend();
  const response = await apiFetch('/api/v1/think/memory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Failed to save memory');
  return data;
}

export async function forgetMemoryEntry(id) {
  requireBackend();
  const response = await apiFetch(`/api/v1/think/memory/${id}`, { method: 'DELETE' });
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Failed to forget memory');
  return data;
}

export async function listThinkingLogs() {
  requireBackend();
  const response = await apiFetch('/api/v1/think/logs');
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Failed to load thinking logs');
  return data;
}

export async function getThinkingLog(id) {
  requireBackend();
  const response = await apiFetch(`/api/v1/think/logs/${id}`);
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Failed to load thinking log');
  return data;
}

// --- Research paper system ---

export async function listResearchProjects() {
  requireBackend();
  const response = await apiFetch('/api/v1/research/projects');
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Failed to list research projects');
  return data;
}

export async function createResearchProject(payload) {
  requireBackend();
  const response = await apiFetch('/api/v1/research/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Failed to create research project');
  return data;
}

export async function getResearchProject(projectId) {
  requireBackend();
  const response = await apiFetch(`/api/v1/research/projects/${projectId}`);
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Failed to load research project');
  return data;
}

export async function createResearchPaper(projectId, paper) {
  requireBackend();
  const response = await apiFetch(`/api/v1/research/projects/${projectId}/papers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(paper),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Failed to save paper');
  return data;
}

export async function createResearchDerivation(projectId, derivation) {
  requireBackend();
  const response = await apiFetch(`/api/v1/research/projects/${projectId}/derivations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(derivation),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Failed to save derivation');
  return data;
}

export async function createResearchSimulation(projectId, payload) {
  requireBackend();
  const response = await apiFetch(`/api/v1/research/projects/${projectId}/simulations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Failed to create simulation run');
  return data;
}

export async function updateSimulationResults(simulationId, payload) {
  requireBackend();
  const response = await apiFetch(`/api/v1/research/simulations/${simulationId}/results`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Failed to update simulation results');
  return data;
}

export async function listResearchPapers(projectId) {
  requireBackend();
  const response = await apiFetch(`/api/v1/research/projects/${projectId}/papers`);
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Failed to list papers');
  return data;
}

export async function listResearchSimulations(projectId) {
  requireBackend();
  const response = await apiFetch(`/api/v1/research/projects/${projectId}/simulations`);
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Failed to list simulations');
  return data;
}

// ── PromptToVideo AI ─────────────────────────────────────────────────────────

export async function getPromptToVideoSteps() {
  requireBackend();
  const response = await apiFetch('/api/v1/prompt-to-video/steps');
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Failed to load video steps');
  return data;
}

export async function getTransformerArchitecture() {
  requireBackend();
  const response = await apiFetch('/api/v1/models/transformer-architecture');
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Failed to load architecture');
  return data;
}

export async function generatePromptToVideo({ prompt, stream = true, quality = '1080p', subtitle }) {
  requireBackend();
  const response = await apiFetch('/api/v1/prompt-to-video/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, stream, quality, subtitle }),
  });

  if (!response.ok) {
    const error = await parseJsonResponse(response).catch(() => ({}));
    throwApiError(response, error);
  }

  if (stream) return response;
  return parseJsonResponse(response);
}

export async function listPromptToVideoJobs() {
  requireBackend();
  const response = await apiFetch('/api/v1/prompt-to-video/jobs');
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Failed to list videos');
  return data;
}

export async function getPromptToVideoJob(id) {
  requireBackend();
  const response = await apiFetch(`/api/v1/prompt-to-video/jobs/${id}`);
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Failed to load video job');
  return data;
}

export async function deletePromptToVideoJob(id) {
  requireBackend();
  const response = await apiFetch(`/api/v1/prompt-to-video/jobs/${id}`, { method: 'DELETE' });
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Failed to delete video');
  return data;
}

export async function cancelPromptToVideoJob(id) {
  requireBackend();
  const response = await apiFetch(`/api/v1/prompt-to-video/jobs/${id}/cancel`, { method: 'POST' });
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Failed to cancel generation');
  return data;
}
