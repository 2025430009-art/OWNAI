import { OLLAMA_MODELS } from './modelRouter.js';

const OLLAMA_BASE = (import.meta.env.VITE_OLLAMA_URL || 'http://localhost:11434').replace(/\/$/, '');
const DEFAULT_MODEL = import.meta.env.VITE_OLLAMA_MODEL || OLLAMA_MODELS.CHAT;
const OLLAMA_TIMEOUT_MS = 15_000;

export const RECOMMENDED_OLLAMA_MODELS = [
  OLLAMA_MODELS.CHAT,
  OLLAMA_MODELS.FALLBACK,
  OLLAMA_MODELS.CODE,
  'llama3.2',
  'phi4',
];

let ollamaCache = null;
let ollamaCacheAt = 0;
const CACHE_MS = 15000;

export function getOllamaUrl() {
  return OLLAMA_BASE;
}

export function getSelectedOllamaModel() {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('ownai-ollama-model');
    if (saved) return saved;
  }
  return DEFAULT_MODEL;
}

export function setSelectedOllamaModel(model) {
  if (typeof localStorage !== 'undefined' && model) {
    localStorage.setItem('ownai-ollama-model', model);
  }
}

export async function isOllamaAvailable(force = false) {
  const now = Date.now();
  if (!force && ollamaCache !== null && now - ollamaCacheAt < CACHE_MS) {
    return ollamaCache;
  }
  try {
    const response = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(2500),
    });
    ollamaCache = response.ok;
  } catch {
    ollamaCache = false;
  }
  ollamaCacheAt = now;
  return ollamaCache;
}

export async function listOllamaModels() {
  try {
    const response = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.models || []).map((m) => m.name);
  } catch {
    return [];
  }
}

/**
 * Pick an installed Ollama model — prefers fast models, falls back gracefully.
 */
export async function resolveOllamaModel(preferred) {
  const models = await listOllamaModels();
  const choice = preferred || getSelectedOllamaModel();

  if (!models.length) return choice;

  if (models.includes(choice)) return choice;

  const base = choice.split(':')[0];
  const tagged = models.find((m) => m === base || m.startsWith(`${base}:`));
  if (tagged) return tagged;

  for (const candidate of RECOMMENDED_OLLAMA_MODELS) {
    const hit = models.find((m) => m === candidate || m.startsWith(`${candidate.split(':')[0]}:`));
    if (hit) return hit;
  }

  return models[0];
}

async function* readOllamaChatStream(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed.message?.content) yield parsed.message.content;
        if (parsed.done) return;
      } catch {
        // skip malformed line
      }
    }
  }
}

async function fetchOllamaChatStream(model, messages, temperature) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

  try {
    const response = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        options: { temperature, num_predict: 512 },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        detail.includes('not found')
          ? `Model "${model}" is not installed. Run: ollama pull ${model.split(':')[0]}`
          : 'Ollama is not responding. Check that it is running.',
      );
    }

    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function* streamOllamaChat({
  messages,
  model = getSelectedOllamaModel(),
  temperature = 0.7,
}) {
  const primary = await resolveOllamaModel(model);
  const fallback = await resolveOllamaModel(OLLAMA_MODELS.FALLBACK);
  const modelsToTry = [primary];
  if (fallback !== primary) modelsToTry.push(fallback);

  let lastError;
  for (const tryModel of modelsToTry) {
    try {
      const response = await fetchOllamaChatStream(tryModel, messages, temperature);
      yield* readOllamaChatStream(response);
      return;
    } catch (error) {
      lastError = error;
      if (error.name === 'AbortError') {
        lastError = new Error(`Ollama timed out after ${OLLAMA_TIMEOUT_MS / 1000}s — trying fallback model`);
        lastError.code = 'timeout';
      }
    }
  }

  throw lastError || new Error('Ollama is not responding. Check that it is running.');
}

/** @deprecated Prefer streamOllamaChat with full message history */
export async function* streamOllama({
  prompt,
  model = getSelectedOllamaModel(),
  temperature = 0.7,
}) {
  yield* streamOllamaChat({
    messages: [{ role: 'user', content: prompt }],
    model,
    temperature,
  });
}

export async function generateOllama(options) {
  let text = '';
  for await (const token of streamOllama(options)) {
    text += token;
  }
  return text;
}
