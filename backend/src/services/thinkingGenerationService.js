import { modelManager } from './modelManager.js';
import { isAnthropicAvailable, streamAnthropicMessages, mapHistoryToAnthropicMessages } from './anthropicService.js';
import { streamOllamaInference, isQvacOrRpcError } from './ollamaInference.js';
import { isOllamaReachable } from '../utils/ollamaClient.js';
import { config } from '../config/index.js';
import {
  resolveThinkingMode,
  buildReasoningSystemPrompt,
  buildPromptForMode,
  normalizeThinkingOutput,
  shouldUseAnthropicExtendedThinking,
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

async function runOllamaFallback({
  prompt,
  history,
  mode,
  onEvent,
  temperature,
}) {
  logger.warn('[Inference] QVAC unavailable — silent fallback to Ollama direct mode');
  onEvent?.({ type: 'meta', fallback_provider: 'ollama', silent_fallback: true });

  let fullText = '';
  await streamOllamaInference({
    prompt,
    history,
    temperature,
    onToken: (token) => {
      fullText += token;
      onEvent?.({ type: 'text', token });
    },
  });

  const normalized = normalizeThinkingOutput(fullText, THINKING_MODES.DIRECT);
  if (normalized.answer !== fullText) {
    onEvent?.({ type: 'text_replace', text: normalized.answer });
  }
  return {
    text: normalized.answer || fullText,
    thinking: '',
    structured: normalized.structured,
    mode: THINKING_MODES.DIRECT,
  };
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
  const reasoningEnabled = config.inference?.enableReasoning !== false;
  const effectiveReasoningMode = reasoningEnabled ? reasoningMode : 'direct';

  const resolved = resolveThinkingMode(prompt, effectiveReasoningMode, context);
  const mode = reasoningEnabled ? resolved.mode : THINKING_MODES.DIRECT;
  const reasoningSystem = reasoningEnabled ? buildReasoningSystemPrompt(mode) : '';
  const modePrompt = reasoningEnabled
    ? buildPromptForMode(mode, prompt, context, context.tools || [])
    : prompt;

  onEvent?.(buildModeMeta(resolved, {
    provider: isAnthropicAvailable() ? 'anthropic' : 'local',
    reasoning_enabled: reasoningEnabled,
  }));

  const finalizeOutput = (rawText, streamedThinking = '') => {
    const normalized = normalizeThinkingOutput(rawText, mode);
    if (reasoningEnabled && normalized.thinking) {
      onEvent?.({ type: 'thinking_replace', text: normalized.thinking });
    } else if (reasoningEnabled && streamedThinking) {
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
      thinking: reasoningEnabled ? (normalized.thinking || streamedThinking) : '',
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
        enableThinking: reasoningEnabled && (
          shouldUseAnthropicExtendedThinking(mode, true)
          || mode !== THINKING_MODES.DIRECT
        ),
        onEvent: (event) => {
          if (event.type === 'thinking') fullThinking += event.token;
          else if (event.type === 'text') fullText += event.token;
          onEvent?.(event);
        },
      });

      return finalizeOutput(fullText, fullThinking);
    }

    if (modelManager.isEnabled()) {
      try {
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
      } catch (qvacError) {
        logger.warn('[Inference] QVAC path failed', { error: qvacError.message });
        if (!isQvacOrRpcError(qvacError) && qvacError.code !== 'qvac_disabled') {
          throw qvacError;
        }
      }
    } else {
      logger.info('[Inference] QVAC skipped (disabled for this environment)');
    }

    if (await isOllamaReachable()) {
      return runOllamaFallback({
        prompt: modePrompt,
        history,
        mode,
        onEvent,
        temperature,
      });
    }

    throw new Error('No inference provider available');
  } catch (error) {
    logger.warn('Thinking generation failed', { error: error.message, code: error.code });

    if (await isOllamaReachable()) {
      try {
        return runOllamaFallback({
          prompt,
          history,
          mode: THINKING_MODES.DIRECT,
          onEvent,
          temperature,
        });
      } catch (ollamaError) {
        logger.error('[Inference] Ollama fallback also failed', { error: ollamaError.message });
      }
    }

    const friendlyText = 'I had trouble reaching the AI engine. Please try again in a moment.';
    onEvent?.({ type: 'text_replace', text: friendlyText });
    onEvent?.({ type: 'meta', fallback: true, silent_fallback: true });
    return {
      text: friendlyText,
      thinking: '',
      mode,
      fallback: true,
    };
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
