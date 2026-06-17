import { thinkMessage } from '../api/client.js';
import { consumeThinkingSse } from './thinkingStreamClient.js';

const CACHE_MAX = 30;
const CACHE_TTL_MS = 10 * 60 * 1000;

/** @type {Map<string, { payload: object, expires: number }>} */
const localCache = new Map();

function normalizeKey(message, context = {}) {
  const memory = context.working_memory || [];
  const base = String(message || '').trim().toLowerCase();
  const mem = memory.map((m) => `${m.role}:${m.content}`).join('|');
  return `${base}::${mem}`;
}

function getCached(key) {
  const entry = localCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    localCache.delete(key);
    return null;
  }
  return entry.payload;
}

function setCached(key, payload) {
  if (localCache.size >= CACHE_MAX) {
    const oldest = localCache.keys().next().value;
    localCache.delete(oldest);
  }
  localCache.set(key, { payload, expires: Date.now() + CACHE_TTL_MS });
}

function isFailureAnswer(text, meta = {}) {
  const normalized = String(text || '').trim();
  if (!normalized) return true;
  if (meta.fallback || meta.pipeline_meta?.failed) return true;
  if (normalized.includes('I encountered an issue while reasoning through your request')) return true;
  if (normalized.startsWith('Reasoning timed out')) return true;
  if (normalized.startsWith('Low confidence result')) return true;
  if (normalized.startsWith('Could not parse the model response')) return true;
  if (normalized.startsWith('The model failed to complete reasoning')) return true;
  if (normalized.startsWith('AI provider is unavailable')) return true;
  if (normalized.startsWith('Reasoning failed')) return true;
  return false;
}

function classifyClientError(error) {
  const msg = String(error?.message || '').toLowerCase();
  if (msg.includes('timeout') || msg.includes('timed out')) {
    return { code: 'timeout', message: error.message };
  }
  if (msg.includes('fetch') || msg.includes('network')) {
    return { code: 'network_error', message: error.message };
  }
  if (msg.includes('validation') || msg.includes('parse')) {
    return { code: 'parse_error', message: error.message };
  }
  return { code: 'model_error', message: error?.message || 'Request failed' };
}

function buildUserFacingError(failure) {
  switch (failure.code) {
    case 'timeout':
      return 'Reasoning took too long. The backend switched to a simpler answer path.';
    case 'low_confidence':
      return 'Confidence was low, so the backend simplified and retried automatically.';
    case 'parse_error':
      return 'The model response could not be parsed. Try rephrasing your question.';
    case 'network_error':
      return 'Could not reach the reasoning backend. Check your API connection.';
    case 'provider_error':
      return 'The AI provider is unavailable. Verify backend API keys on Render.';
    default:
      return failure.message || 'Human Think failed. Please try again.';
  }
}

/**
 * Client wrapper for human_think — streaming + local cache only.
 * Retry/timeout/fallback logic lives on the backend pipeline.
 */
export async function runHumanThinkPipeline({
  message,
  context = {},
  onToken,
  onThinking,
  onConfidence,
  onMeta,
  onThinkingResult,
  onStatus,
}) {
  const key = normalizeKey(message, context);
  const cached = getCached(key);
  if (cached) {
    onStatus?.({ type: 'cache_hit' });
    onToken?.(cached.final_answer);
    if (cached.thinking) onThinking?.(cached.thinking);
    if (cached.confidence) onConfidence?.(cached.confidence);
    return cached;
  }

  let pipelineMeta = null;
  let sawError = null;

  const response = await thinkMessage({
    message,
    mode: 'human_think',
    context: { ...context, score_confidence: true },
    stream: true,
    use_extended_thinking: false,
  });

  const streamed = await consumeThinkingSse(response, {
    onText: (full) => onToken?.(full),
    onThinking: (full) => onThinking?.(full),
    onConfidence: (conf) => onConfidence?.(conf),
    onMeta: (meta) => {
      if (meta.pipeline_retry) {
        onStatus?.({
          type: 'retry',
          attempt: meta.attempt,
          code: meta.failure_code,
          message: meta.failure_message,
        });
      }
      if (meta.cache_hit) onStatus?.({ type: 'cache_hit' });
      if (meta.fallback_mode) {
        onStatus?.({
          type: 'fallback',
          mode: meta.fallback_mode,
          code: meta.failure_code,
        });
      }
      if (meta.pipeline_meta) pipelineMeta = meta.pipeline_meta;
      onMeta?.(meta);
    },
    onThinkingResult: (tr) => {
      if (tr?.pipeline_meta) pipelineMeta = tr.pipeline_meta;
      onThinkingResult?.(tr);
    },
    onError: (err) => {
      sawError = err;
      onStatus?.({ type: 'error', ...err });
    },
  });

  const answer = streamed.text?.trim() || '';
  const meta = streamed.meta || {};

  if (sawError || isFailureAnswer(answer, { ...meta, pipeline_meta: pipelineMeta })) {
    throw new Error(
      sawError?.message
      || buildUserFacingError({ code: meta.failure_code || 'model_error', message: answer }),
    );
  }

  const payload = {
    final_answer: answer,
    thinking: streamed.thinking,
    confidence: streamed.confidence,
    confidenceDetail: streamed.confidence?.detail,
    thinkingResult: streamed.thinkingResult,
    meta: streamed.meta,
    mode_used: pipelineMeta?.mode_used || meta.fallback_mode || 'human_think',
    pipeline_meta: pipelineMeta || streamed.thinkingResult?.pipeline_meta || meta,
  };

  setCached(key, payload);
  return payload;
}

export {
  buildUserFacingError,
  classifyClientError,
  isFailureAnswer as isGenericFailure,
};
