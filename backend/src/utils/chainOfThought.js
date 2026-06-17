import { chatOllama, streamOllamaChat } from './ollamaClient.js';
import { detectTask, OLLAMA_MODELS } from './modelRouter.js';

function buildThinkPrompt(question) {
  return `Question: ${question}

Think briefly in 2-3 steps, then give a clear answer. Keep it concise.`;
}

/**
 * Single-pass Ollama answer with optional lightweight think prompt.
 * Uses fast models and 15s timeout with automatic fallback.
 */
export async function thinkThenAnswer(question, modelOverride) {
  const { model, mode } = modelOverride
    ? { model: modelOverride, mode: 'CUSTOM' }
    : detectTask(question);

  const useCoT = mode === 'THINK MODE' || mode === 'DEEP MODE';
  const content = useCoT
    ? await chatOllama({
        model,
        messages: [{ role: 'user', content: buildThinkPrompt(question) }],
        fallbackModel: OLLAMA_MODELS.FALLBACK,
      })
    : await chatOllama({
        model,
        messages: [{ role: 'user', content: question }],
        fallbackModel: OLLAMA_MODELS.FALLBACK,
      });

  return { content, model, mode, usedCoT: useCoT };
}

export { buildThinkPrompt };
