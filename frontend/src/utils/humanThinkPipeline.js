import { thinkMessage } from '../api/client.js';
import { consumeThinkingSse } from './thinkingStreamClient.js';

const MAX_CLIENT_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 50_000;
const CACHE_MAX = 30;
const CACHE_TTL_MS = 10 * 60 * 1000;
const LOW_CONFIDENCE_THRESHOLD = 60;

const GENERIC_FALLBACK = 'I encountered an issue while reasoning through your request';

/** @type {Map<string, { payload: object, expires: number }>} */
const localCache = new Map();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function isGenericFailure(text) {
  const normalized = String(text || '').trim();
  return !normalized || normalized.includes(GENERIC_FALLBACK);
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
      return 'Reasoning took too long. A simpler answer was requested automatically.';
    case 'low_confidence':
      return 'Confidence was low, so the reasoning chain was simplified and retried.';
    case 'parse_error':
      return 'The model response could not be parsed. Retrying with a simpler format.';
    case 'network_error':
      return 'Could not reach the reasoning backend. Check your API connection.';
    case 'provider_error':
      return 'The AI provider is unavailable. Verify backend API keys.';
    default:
      return failure.message || 'Human Think failed after multiple retries.';
  }
}

async function fetchWithTimeout(promiseFactory, timeoutMs) {
  return Promise.race([
    promiseFactory(),
    sleep(timeoutMs).then(() => {
      const err = new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s`);
      err.code = 'timeout';
      throw err;
    }),
  ]);
}

async function streamHumanThink({
  message,
  context,
  mode,
  onToken,
  onThinking,
  onConfidence,
  onMeta,
  onThinkingResult,
  onStatus,
}) {
  const response = await thinkMessage({
    message,
    mode,
    context,
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
      onMeta?.(meta);
    },
    onThinkingResult: (tr) => onThinkingResult?.(tr),
    onError: (err) => onStatus?.({ type: 'error', ...err }),
  });

  return streamed;
}

/**
 * Client-side resilient human_think pipeline:
 * cache → stream → retry → timeout → silent direct fallback.
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

  let lastFailure = null;
  const modes = ['human_think', 'human_think', 'direct'];

  for (let attempt = 0; attempt < MAX_CLIENT_RETRIES; attempt += 1) {
    const mode = attempt >= 2 ? 'direct' : modes[attempt];
    const simplified = attempt > 0;

    if (simplified) {
      onStatus?.({
        type: 'retry',
        attempt: attempt + 1,
        code: lastFailure?.code || 'low_confidence',
        message: buildUserFacingError(lastFailure || { code: 'model_error' }),
      });
    }

    try {
      const streamed = await fetchWithTimeout(
        () => streamHumanThink({
          message,
          context: {
            ...context,
            score_confidence: true,
            pipeline_simplified: simplified,
          },
          mode,
          onToken,
          onThinking,
          onConfidence,
          onMeta,
          onThinkingResult,
          onStatus,
        }),
        REQUEST_TIMEOUT_MS,
      );

      const answer = streamed.text?.trim() || '';
      const confidenceScore = streamed.confidence?.score;

      if (isGenericFailure(answer)) {
        lastFailure = { code: 'model_error', message: 'Generic fallback response received' };
        if (attempt < MAX_CLIENT_RETRIES - 1) {
          await sleep(400 * (attempt + 1));
          continue;
        }
      } else if (
        confidenceScore != null
        && confidenceScore < LOW_CONFIDENCE_THRESHOLD
        && mode === 'human_think'
        && attempt < MAX_CLIENT_RETRIES - 1
      ) {
        lastFailure = { code: 'low_confidence', message: `Confidence ${confidenceScore}%` };
        await sleep(300);
        continue;
      } else {
        const payload = {
          final_answer: answer,
          thinking: streamed.thinking,
          confidence: streamed.confidence,
          confidenceDetail: streamed.confidence?.detail,
          thinkingResult: streamed.thinkingResult,
          meta: streamed.meta,
          mode_used: streamed.meta?.fallback_mode || mode,
          pipeline_meta: streamed.thinkingResult?.pipeline_meta || streamed.meta,
        };
        setCached(key, payload);
        return payload;
      }
    } catch (error) {
      lastFailure = classifyClientError(error);
      onStatus?.({ type: 'error', ...lastFailure });
      if (attempt < MAX_CLIENT_RETRIES - 1) {
        await sleep(500 * (attempt + 1));
        continue;
      }
    }
  }

  // Last resort: non-stream direct call
  try {
    onStatus?.({ type: 'fallback', mode: 'direct', code: lastFailure?.code || 'unknown' });
    const result = await thinkMessage({
      message,
      mode: 'direct',
      context: { score_confidence: true },
      stream: false,
    });
    const answer = result.final_answer?.trim() || '';
    if (answer) {
      const payload = {
        final_answer: answer,
        thinking: result.thinking || '',
        confidence: result.confidence != null ? { score: result.confidence } : null,
        confidenceDetail: result.confidence_detail,
        mode_used: 'direct',
        pipeline_meta: { silent_fallback: true, failure_code: lastFailure?.code },
      };
      setCached(key, payload);
      onToken?.(answer);
      return payload;
    }
  } catch (error) {
    lastFailure = classifyClientError(error);
  }

  throw new Error(buildUserFacingError(lastFailure || { code: 'unknown' }));
}

export {
  buildUserFacingError,
  classifyClientError,
  isGenericFailure,
  LOW_CONFIDENCE_THRESHOLD,
};
