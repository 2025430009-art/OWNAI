import { modelManager } from './modelManager.js';
import { isAnthropicAvailable, streamAnthropicMessages, mapHistoryToAnthropicMessages } from './anthropicService.js';
import {
  resolveThinkingMode,
  buildReasoningSystemPrompt,
  buildPromptForMode,
  normalizeThinkingOutput,
  shouldUseAnthropicExtendedThinking,
  buildFallbackResponse,
  buildModeMeta,
  THINKING_MODES,
} from '../ai/thinkingEngine.js';
import { logger } from '../utils/logger.js';

function mergeSystemMessages(history, reasoningSystem) {
  const existing = history
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const merged = [existing, reasoningSystem].filter(Boolean).join('\n\n');
  const turns = history.filter((m) => m.role !== 'system');
  return [{ role: 'system', content: merged }, ...turns];
}

/**
 * Run AI generation with thinking engine rules. Always supports SSE event callback.
 */
export async function runThinkingGeneration({
  prompt,
  history = [],
  maxTokens = 1024,
  temperature = 0.4,
  modelKey,
  modelSrc,
  reasoningMode = 'auto',
  context = {},
  onEvent,
}) {
  const resolved = resolveThinkingMode(prompt, reasoningMode, context);
  const mode = resolved.mode;
  const reasoningSystem = buildReasoningSystemPrompt(mode);
  const modePrompt = buildPromptForMode(mode, prompt, context, context.tools || []);

  onEvent?.(buildModeMeta(resolved, {
    provider: isAnthropicAvailable() ? 'anthropic' : 'local',
  }));

  const finalizeOutput = (rawText, streamedThinking = '') => {
    const normalized = normalizeThinkingOutput(rawText, mode);
    if (normalized.thinking) {
      onEvent?.({ type: 'thinking_replace', text: normalized.thinking });
    } else if (streamedThinking) {
      onEvent?.({ type: 'thinking_replace', text: streamedThinking });
    }
    if (normalized.confidence != null) {
      onEvent?.({
        type: 'confidence',
        score: normalized.confidence,
        reasoning: normalized.structured?.confidence_reasoning || null,
      });
    }
    if (normalized.answer !== rawText) {
      onEvent?.({ type: 'text_replace', text: normalized.answer });
    }
    return {
      text: normalized.answer,
      thinking: normalized.thinking || streamedThinking,
      structured: normalized.structured,
      mode,
    };
  };

  try {
    if (isAnthropicAvailable()) {
      const { system, messages } = mapHistoryToAnthropicMessages(history);
      const mergedSystem = [system, reasoningSystem].filter(Boolean).join('\n\n');
      const anthropicMessages = [...messages];

      if (!anthropicMessages.length || anthropicMessages.at(-1).role !== 'user') {
        anthropicMessages.push({ role: 'user', content: modePrompt });
      } else {
        anthropicMessages[anthropicMessages.length - 1] = {
          role: 'user',
          content: buildPromptForMode(mode, anthropicMessages.at(-1).content, context, context.tools || []),
        };
      }

      let fullText = '';
      let fullThinking = '';

      await streamAnthropicMessages({
        messages: anthropicMessages,
        system: mergedSystem,
        maxTokens,
        temperature,
        enableThinking: shouldUseAnthropicExtendedThinking(mode, true)
          || mode !== THINKING_MODES.DIRECT,
        onEvent: (event) => {
          if (event.type === 'thinking') fullThinking += event.token;
          else if (event.type === 'text') fullText += event.token;
          onEvent?.(event);
        },
      });

      return finalizeOutput(fullText, fullThinking);
    }

    const localHistory = mergeSystemMessages(history, reasoningSystem);
    const lastUserIdx = localHistory.map((m) => m.role).lastIndexOf('user');
    if (lastUserIdx >= 0) {
      localHistory[lastUserIdx] = { role: 'user', content: modePrompt };
    } else {
      localHistory.push({ role: 'user', content: modePrompt });
    }

    const run = await modelManager.generateStream(
      modePrompt,
      {
        modelKey,
        modelSrc,
        max_tokens: maxTokens,
        temperature,
        history: localHistory,
      },
    );

    let fullText = '';
    for await (const token of run.tokenStream) {
      fullText += token;
      onEvent?.({ type: 'text', token });
    }

    return finalizeOutput(fullText);
  } catch (error) {
    logger.warn('Thinking generation failed, using fallback', { error: error.message });
    const fallback = buildFallbackResponse(error);
    onEvent?.({ type: 'thinking', token: fallback.thinking });
    onEvent?.({ type: 'text', token: fallback.text });
    onEvent?.({
      type: 'confidence',
      score: fallback.confidence.score,
      reasoning: fallback.confidence.reasoning,
    });
    onEvent?.({ type: 'meta', fallback: true });
    return { text: fallback.text, thinking: fallback.thinking, mode, fallback: true };
  }
}

export function writeThinkingSseEvent(res, event) {
  if (event.type === 'text' || event.type === 'thinking') {
    res.write(`data: ${JSON.stringify({ type: event.type, token: event.token })}\n\n`);
    return;
  }
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

export async function streamThinkingToResponse(res, params) {
  const result = await runThinkingGeneration({
    ...params,
    onEvent: (event) => writeThinkingSseEvent(res, event),
  });
  res.write('data: [DONE]\n\n');
  res.end();
  return result;
}
