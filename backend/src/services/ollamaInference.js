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
    || msg.includes('Bare worker');
}

/**
 * Stream a direct Ollama answer — used when QVAC worker/RPC fails.
 */
export async function streamOllamaInference({
  prompt,
  history = [],
  onToken,
  model,
  temperature = 0.5,
}) {
  const routed = detectTask(prompt);
  const chosenModel = model || routed.model || OLLAMA_MODELS.CHAT;
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
