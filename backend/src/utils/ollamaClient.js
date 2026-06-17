import { OLLAMA_MODELS } from './modelRouter.js';

const OLLAMA_BASE = (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/$/, '');
const OLLAMA_TIMEOUT_MS = 15_000;

async function ollamaFetch(path, body, { stream = false, signal } = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

  const mergedSignal = signal
    ? AbortSignal.any([signal, controller.signal])
    : controller.signal;

  try {
    const response = await fetch(`${OLLAMA_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: mergedSignal,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Ollama error (${response.status}): ${text || 'not responding'}`);
    }
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function chatOllama({
  model,
  messages,
  stream = false,
  temperature = 0.7,
  fallbackModel = OLLAMA_MODELS.FALLBACK,
}) {
  const modelsToTry = [model, fallbackModel].filter((m, i, arr) => m && arr.indexOf(m) === i);

  let lastError;
  for (const tryModel of modelsToTry) {
    try {
      const response = await ollamaFetch('/api/chat', {
        model: tryModel,
        messages,
        stream,
        options: { temperature, num_predict: 512 },
      }, { stream });

      if (stream) return response;

      const data = await response.json();
      return data.message?.content ?? '';
    } catch (error) {
      lastError = error;
      if (error.name === 'AbortError') {
        lastError = new Error(`Ollama timed out after ${OLLAMA_TIMEOUT_MS / 1000}s (model: ${tryModel})`);
        lastError.code = 'timeout';
      }
    }
  }

  throw lastError || new Error('Ollama request failed');
}

export async function* streamOllamaChat({
  model,
  messages,
  temperature = 0.7,
  fallbackModel = OLLAMA_MODELS.FALLBACK,
}) {
  const modelsToTry = [model, fallbackModel].filter((m, i, arr) => m && arr.indexOf(m) === i);

  let lastError;
  for (const tryModel of modelsToTry) {
    try {
      const response = await ollamaFetch('/api/chat', {
        model: tryModel,
        messages,
        stream: true,
        options: { temperature, num_predict: 512 },
      }, { stream: true });

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
      return;
    } catch (error) {
      lastError = error;
      if (error.name === 'AbortError') {
        lastError = new Error(`Ollama timed out after ${OLLAMA_TIMEOUT_MS / 1000}s (model: ${tryModel})`);
        lastError.code = 'timeout';
      }
    }
  }

  throw lastError || new Error('Ollama stream failed');
}

export async function isOllamaReachable() {
  try {
    const response = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(2500),
    });
    return response.ok;
  } catch {
    return false;
  }
}
