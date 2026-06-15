import { chatOllama } from './ollamaClient.js';
import { detectTask } from './modelRouter.js';

function buildThinkPrompt(question) {
  return `Question: ${question}

Before answering, think through this carefully:
1. What exactly is being asked?
2. What do I know about this topic?
3. What are the key points to address?
4. What would be the clearest explanation?

Now provide a thorough, accurate answer:`;
}

function buildCritiquePrompt(answer) {
  return `Your answer:
${answer}

Self-check:
- Is this accurate?
- Is this complete?
- Is this clear?
- Could this be improved?

If yes to any improvement: rewrite it better.
If no: return the same answer unchanged.`;
}

/**
 * Two-pass chain-of-thought via Ollama (THINK / DEEP modes).
 * Falls back to single-pass if Ollama is unavailable.
 */
export async function thinkThenAnswer(question, modelOverride) {
  const { model, mode } = modelOverride
    ? { model: modelOverride, mode: 'CUSTOM' }
    : detectTask(question);

  const useCoT = mode === 'THINK MODE' || mode === 'DEEP MODE';

  if (!useCoT) {
    const content = await chatOllama({
      model,
      messages: [{ role: 'user', content: question }],
    });
    return { content, model, mode, usedCoT: false };
  }

  const draft = await chatOllama({
    model,
    messages: [{ role: 'user', content: buildThinkPrompt(question) }],
  });

  const refined = await chatOllama({
    model,
    messages: [{ role: 'user', content: buildCritiquePrompt(draft) }],
  });

  return {
    content: refined?.trim() || draft,
    model,
    mode,
    usedCoT: true,
  };
}

export { buildThinkPrompt, buildCritiquePrompt };
