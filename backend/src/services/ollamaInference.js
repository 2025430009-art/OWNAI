import { OLLAMA_URL, INFERENCE_MODEL } from '../config/index.js';
import { streamOllamaChat } from '../utils/ollamaClient.js';
import { detectTask, OLLAMA_MODELS } from '../utils/modelRouter.js';
import { logger } from '../utils/logger.js';

function historyToMessages(history = [], prompt = '') {
  const turns = history
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: m.content }));
  if (prompt && (!turns.length || turns.at(-1).role !== 'user')) {
    turns.push({ role: 'user', content: prompt });
  }
  return turns.slice(-6);
}

function isQvacOrRpcError(error) {
  const msg = String(error?.message || error || '');
  return msg.includes('50204')
    || msg.includes('RPC initialization')
    || msg.includes('RPC_INIT_TIMEOUT')
    || msg.includes('WORKER_CRASHED')
    || msg.includes('Bare worker')
    || msg.includes('bare');
}

/**
 * Direct Ollama /api/generate stream — bulletproof fallback when QVAC is unavailable.
 */
export async function ollamaInfer(prompt, onToken, model = INFERENCE_MODEL) {
  const baseUrl = OLLAMA_URL.replace(/\/$/, '');
  logger.info('[Ollama] inference start', { model });

  const res = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: true }),
  });

  if (!res.ok) {
    throw new Error(`Ollama ${res.status}`);
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buffer = '';
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += dec.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const json = JSON.parse(line);
        if (json.response) {
          full += json.response;
          onToken?.(json.response);
        }
        if (json.done) {
          logger.info('[Ollama] inference complete', { chars: full.length });
          return full;
        }
      } catch {
        // skip malformed stream chunks
      }
    }
  }

  logger.info('[Ollama] inference complete', { chars: full.length });
  return full;
}

/**
 * Stream a direct Ollama chat answer with conversation history.
 */
export async function streamOllamaInference({
  prompt,
  history = [],
  onToken,
  model,
  temperature = 0.5,
}) {
  const routed = detectTask(prompt);
  const chosenModel = model || routed.model || OLLAMA_MODELS.CHAT || INFERENCE_MODEL;
  const messages = historyToMessages(history, prompt);

  logger.info('[Ollama] inference start', { model: chosenModel, turns: messages.length });

  let fullText = '';
  for await (const token of streamOllamaChat({
    model: chosenModel,
    messages,
    temperature,
  })) {
    fullText += token;
    onToken?.(token);
  }

  logger.info('[Ollama] inference complete', { chars: fullText.length });
  return fullText;
}

export { isQvacOrRpcError };
