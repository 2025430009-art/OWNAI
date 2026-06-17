import { modelManager } from './modelManager.js';
import { streamAnthropicMessages, mapHistoryToAnthropicMessages } from './anthropicService.js';
import { ollamaInfer, streamOllamaInference } from './ollamaInference.js';
import {
  ENABLE_QVAC,
  ENABLE_REASONING,
  ANTHROPIC_KEY,
} from '../config/index.js';
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

const DEFAULT_CONFIDENCE = 85;

function mergeSystemMessages(history, reasoningSystem) {
  const existing = history
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const merged = [existing, reasoningSystem].filter(Boolean).join('\n\n');
  const turns = history.filter((m) => m.role !== 'system');
  return [{ role: 'system', content: merged }, ...turns];
}

function emitConfidence(onEvent, score = DEFAULT_CONFIDENCE) {
  onEvent?.({ type: 'confidence', score, reasoning: null });
}

function finalizeResult(rawText, mode, reasoningEnabled, streamedThinking = '', onEvent) {
  const normalized = normalizeThinkingOutput(rawText, mode);
  if (reasoningEnabled && normalized.thinking) {
    onEvent?.({ type: 'thinking_replace', text: normalized.thinking });
  } else if (reasoningEnabled && streamedThinking) {
    onEvent?.({ type: 'thinking_replace', text: streamedThinking });
  }

  const confidenceScore = normalized.confidence ?? DEFAULT_CONFIDENCE;
  emitConfidence(onEvent, confidenceScore);

  if (normalized.answer !== rawText) {
    onEvent?.({ type: 'text_replace', text: normalized.answer });
  }

  return {
    text: normalized.answer || rawText,
    thinking: reasoningEnabled ? (normalized.thinking || streamedThinking) : '',
    structured: normalized.structured,
    mode,
    confidence: confidenceScore,
  };
}

async function runAnthropicPath({
  modePrompt,
  history,
  reasoningSystem,
  mode,
  reasoningEnabled,
  maxTokens,
  temperature,
  context,
  onEvent,
}) {
  console.log('[Inference] Using Anthropic');

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

  return finalizeResult(fullText, mode, reasoningEnabled, fullThinking, onEvent);
}

async function runQvacPath({
  modePrompt,
  history,
  reasoningSystem,
  mode,
  reasoningEnabled,
  maxTokens,
  temperature,
  modelKey,
  modelSrc,
  onEvent,
}) {
  const localHistory = mergeSystemMessages(history, reasoningSystem);
  const lastUserIdx = localHistory.map((m) => m.role).lastIndexOf('user');
  if (lastUserIdx >= 0) {
    localHistory[lastUserIdx] = { role: 'user', content: modePrompt };
  } else {
    localHistory.push({ role: 'user', content: modePrompt });
  }

  const run = await modelManager.generateStream(modePrompt, {
    modelKey,
    modelSrc,
    max_tokens: maxTokens,
    temperature,
    history: localHistory,
  });

  if (!run?.tokenStream) return null;

  let fullText = '';
  for await (const token of run.tokenStream) {
    fullText += token;
    onEvent?.({ type: 'text', token });
  }

  return finalizeResult(fullText, mode, reasoningEnabled, '', onEvent);
}

async function runOllamaPath({
  modePrompt,
  history,
  mode,
  reasoningEnabled,
  temperature,
  onEvent,
}) {
  onEvent?.({ type: 'meta', provider: 'ollama', silent_fallback: true });

  let fullText = '';
  try {
    fullText = await streamOllamaInference({
      prompt: modePrompt,
      history,
      temperature,
      onToken: (token) => {
        onEvent?.({ type: 'text', token });
      },
    });
  } catch {
    fullText = await ollamaInfer(modePrompt, (token) => {
      onEvent?.({ type: 'text', token });
    });
  }

  return finalizeResult(fullText, THINKING_MODES.DIRECT, false, '', onEvent);
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
  const reasoningEnabled = ENABLE_REASONING;
  const effectiveReasoningMode = reasoningEnabled ? reasoningMode : 'direct';

  const resolved = resolveThinkingMode(prompt, effectiveReasoningMode, context);
  const mode = reasoningEnabled ? resolved.mode : THINKING_MODES.DIRECT;
  const reasoningSystem = reasoningEnabled ? buildReasoningSystemPrompt(mode) : '';
  const modePrompt = reasoningEnabled
    ? buildPromptForMode(mode, prompt, context, context.tools || [])
    : prompt;

  onEvent?.(buildModeMeta(resolved, {
    provider: ANTHROPIC_KEY ? 'anthropic' : (ENABLE_QVAC ? 'qvac' : 'ollama'),
    reasoning_enabled: reasoningEnabled,
  }));

  const inferenceParams = {
    modePrompt,
    history,
    reasoningSystem,
    mode,
    reasoningEnabled,
    maxTokens,
    temperature,
    modelKey,
    modelSrc,
    context,
    onEvent,
  };

  // PATH 1 — Anthropic (Render / production)
  if (ANTHROPIC_KEY) {
    try {
      return await runAnthropicPath(inferenceParams);
    } catch (error) {
      logger.warn('[Inference] Anthropic failed, trying next provider', { error: error.message });
    }
  }

  // PATH 2 — QVAC (local dev only, if explicitly enabled)
  if (ENABLE_QVAC) {
    try {
      const qvacResult = await runQvacPath(inferenceParams);
      if (qvacResult) return qvacResult;
    } catch (error) {
      console.warn('[Inference] QVAC failed, falling to Ollama:', error.message);
    }
  } else {
    console.log('[QVAC] Skipped — disabled for this environment');
  }

  // PATH 3 — Ollama direct (local fallback)
  try {
    return await runOllamaPath(inferenceParams);
  } catch (error) {
    logger.warn('[Inference] Ollama chat failed, retrying generate API', { error: error.message });
  }

  try {
    return await runOllamaPath({ ...inferenceParams, modePrompt: prompt });
  } catch (error) {
    logger.error('[Inference] All providers exhausted', { error: error.message });
  }

  // Silent last resort — never expose infrastructure errors
  const greeting = 'Hello! I am OWNAI. How can I help you today?';
  onEvent?.({ type: 'text_replace', text: greeting });
  emitConfidence(onEvent, DEFAULT_CONFIDENCE);
  return {
    text: greeting,
    thinking: '',
    mode: THINKING_MODES.DIRECT,
    confidence: DEFAULT_CONFIDENCE,
  };
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
