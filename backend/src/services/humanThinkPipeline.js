import { createHash } from 'crypto';
import { runThinkingGeneration } from './thinkingGenerationService.js';
import { scoreResponseConfidence } from '../ai/refinementEngine.js';
import {
  THINKING_MODES,
  classifyThinkingFailure,
  buildFailureMessage,
  isGenericFallbackText,
} from '../ai/thinkingEngine.js';
import { logger } from '../utils/logger.js';

const MAX_RETRIES = 3;
const TIMEOUT_MS = 45_000;
const LOW_CONFIDENCE_THRESHOLD = 60;
const CACHE_MAX = 50;
const CACHE_TTL_MS = 15 * 60 * 1000;

/** @type {Map<string, { result: object, expires: number }>} */
const responseCache = new Map();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cacheKey(message, context = {}) {
  const memory = context.working_memory || [];
  const normalized = String(message || '').trim().toLowerCase();
  const memorySig = memory.map((m) => `${m.role}:${m.content}`).join('|');
  return createHash('sha256').update(`${normalized}::${memorySig}`).digest('hex').slice(0, 24);
}

function getCached(key) {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    responseCache.delete(key);
    return null;
  }
  return entry.result;
}

function setCached(key, result) {
  if (responseCache.size >= CACHE_MAX) {
    const oldest = responseCache.keys().next().value;
    responseCache.delete(oldest);
  }
  responseCache.set(key, { result, expires: Date.now() + CACHE_TTL_MS });
}

function withTimeout(promise, ms, code = 'timeout') {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error(`Reasoning timed out after ${Math.round(ms / 1000)}s`);
      err.code = code;
      reject(err);
    }, ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function runGenerationAttempt({
  message,
  mode,
  context,
  stream,
  onEvent,
  simplified = false,
}) {
  const effectiveMode = simplified ? THINKING_MODES.DIRECT : mode;
  let rawResponse = '';
  let thinkingScratchpad = '';
  let parsed = null;
  let confidence = null;
  let confidenceStarted = false;
  let confidenceDetailPromise = null;

  const startConfidenceScoring = (draft) => {
    if (!context.score_confidence || confidenceStarted || !draft?.trim()) return;
    confidenceStarted = true;
    confidenceDetailPromise = scoreResponseConfidence(message, draft, context).catch(() => null);
  };

  const result = await runThinkingGeneration({
    prompt: message,
    history: context.history || [],
    maxTokens: simplified ? 2048 : 4096,
    temperature: simplified ? 0.5 : 0.4,
    reasoningMode: effectiveMode,
    context,
    onEvent: (event) => {
      if (event.type === 'text') rawResponse += event.token;
      if (event.type === 'thinking') thinkingScratchpad += event.token;
      if (event.type === 'text_replace') {
        rawResponse = event.text;
        startConfidenceScoring(rawResponse);
      }
      if (event.type === 'thinking_replace') thinkingScratchpad = event.text;
      if (event.type === 'confidence') confidence = event.score;
      onEvent?.(event);
    },
  });

  rawResponse = result.text || rawResponse;
  thinkingScratchpad = result.thinking || thinkingScratchpad;
  parsed = result.structured || null;
  confidence = confidence ?? parsed?.confidence_overall ?? null;

  if (!confidenceStarted && context.score_confidence) {
    startConfidenceScoring(rawResponse);
  }

  const confidenceDetail = confidenceDetailPromise
    ? await confidenceDetailPromise
    : null;

  if (confidenceDetail?.overall != null) {
    confidence = confidenceDetail.overall;
  }

  return {
    final_answer: parsed?.final_answer || rawResponse,
    thinking_scratchpad: thinkingScratchpad,
    parsed,
    confidence,
    confidence_detail: confidenceDetail,
    raw_response: rawResponse,
    mode_used: effectiveMode,
    simplified,
    fallback: Boolean(result.fallback),
  };
}

function isFailedResult(result) {
  if (!result) return true;
  if (result.fallback) return true;
  if (isGenericFallbackText(result.final_answer)) return true;
  if (!result.final_answer?.trim()) return true;
  return false;
}

/**
 * Resilient human_think pipeline:
 * cache → retry → timeout → low-confidence simplify → silent direct fallback.
 */
export async function runHumanThinkPipeline({
  message,
  context = {},
  stream = false,
  onEvent,
}) {
  const key = cacheKey(message, context);
  const cached = getCached(key);
  if (cached) {
    onEvent?.({
      type: 'meta',
      cache_hit: true,
      reasoning_mode: THINKING_MODES.HUMAN_THINK,
    });
    const cachedResult = {
      ...cached,
      pipeline_meta: { ...(cached.pipeline_meta || {}), cache_hit: true },
    };
    if (stream) {
      onEvent?.({ type: 'text_replace', text: cachedResult.final_answer });
      if (cachedResult.thinking_scratchpad) {
        onEvent?.({ type: 'thinking_replace', text: cachedResult.thinking_scratchpad });
      }
      onEvent?.({
        type: 'confidence',
        score: cachedResult.confidence,
        reasoning: cachedResult.pipeline_meta?.note || 'Served from recent cache',
      });
      onEvent?.({
        type: 'result',
        mode: THINKING_MODES.HUMAN_THINK,
        confidence: cachedResult.confidence,
        final_answer: cachedResult.final_answer,
        thinking_scratchpad: cachedResult.thinking_scratchpad,
        parsed: cachedResult.parsed,
        confidence_detail: cachedResult.confidence_detail,
        pipeline_meta: cachedResult.pipeline_meta,
      });
    }
    return cachedResult;
  }

  let lastFailure = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    const simplified = attempt > 1;
    onEvent?.({
      type: 'meta',
      pipeline_attempt: attempt,
      pipeline_max_retries: MAX_RETRIES,
      simplified_reasoning: simplified,
    });

    try {
      const result = await withTimeout(
        runGenerationAttempt({
          message,
          mode: THINKING_MODES.HUMAN_THINK,
          context,
          stream,
          onEvent,
          simplified,
        }),
        TIMEOUT_MS,
      );

      if (isFailedResult(result)) {
        const code = result.fallback ? 'model_error' : 'parse_error';
        lastFailure = { code, message: 'Model returned an unusable response' };
        if (attempt < MAX_RETRIES) {
          onEvent?.({
            type: 'meta',
            pipeline_retry: true,
            failure_code: code,
            attempt,
          });
          await sleep(400 * attempt);
          continue;
        }
        break;
      }

      if (
        result.confidence != null
        && result.confidence < LOW_CONFIDENCE_THRESHOLD
        && attempt < MAX_RETRIES
      ) {
        onEvent?.({
          type: 'meta',
          pipeline_retry: true,
          failure_code: 'low_confidence',
          confidence: result.confidence,
          attempt,
        });
        lastFailure = {
          code: 'low_confidence',
          message: `Confidence ${result.confidence}% below ${LOW_CONFIDENCE_THRESHOLD}%`,
        };
        await sleep(300);
        continue;
      }

      const pipelineMeta = {
        attempt,
        cache_hit: false,
        simplified: result.simplified,
        mode_used: result.mode_used,
      };

      const success = {
        ...result,
        pipeline_meta: pipelineMeta,
      };
      setCached(key, success);
      return success;
    } catch (error) {
      const failure = classifyThinkingFailure(error);
      lastFailure = failure;
      logger.warn('human_think attempt failed', {
        attempt,
        code: failure.code,
        message: failure.message,
      });

      if (attempt < MAX_RETRIES) {
        onEvent?.({
          type: 'meta',
          pipeline_retry: true,
          failure_code: failure.code,
          failure_message: failure.message,
          attempt,
        });
        await sleep(500 * attempt);
        continue;
      }
    }
  }

  // Silent fallback to direct mode — still return a real answer
  try {
    onEvent?.({
      type: 'meta',
      fallback_mode: THINKING_MODES.DIRECT,
      original_mode: THINKING_MODES.HUMAN_THINK,
      failure_code: lastFailure?.code || 'unknown',
    });

    const direct = await withTimeout(
      runGenerationAttempt({
        message,
        mode: THINKING_MODES.DIRECT,
        context,
        stream,
        onEvent,
        simplified: true,
      }),
      Math.min(TIMEOUT_MS, 25_000),
    );

    if (!isFailedResult(direct)) {
      const fallbackResult = {
        ...direct,
        mode_used: THINKING_MODES.DIRECT,
        pipeline_meta: {
          silent_fallback: true,
          original_mode: THINKING_MODES.HUMAN_THINK,
          failure_code: lastFailure?.code || 'unknown',
          failure_message: lastFailure?.message || null,
        },
      };
      setCached(key, fallbackResult);
      return fallbackResult;
    }
  } catch (error) {
    lastFailure = classifyThinkingFailure(error);
  }

  const friendlyText = 'I had trouble reaching the AI engine. Please try again in a moment.';
  onEvent?.({
    type: 'error',
    code: lastFailure?.code || 'unknown',
    message: friendlyText,
    detail: lastFailure?.message || null,
  });

  return {
    final_answer: friendlyText,
    thinking_scratchpad: '',
    parsed: null,
    confidence: 20,
    confidence_detail: {
      overall: 20,
      should_caveat: false,
      caveat_text: '',
      explanation: lastFailure?.message || null,
    },
    raw_response: friendlyText,
    fallback: true,
    pipeline_meta: {
      failed: true,
      failure_code: lastFailure?.code || 'unknown',
      failure_message: lastFailure?.message || null,
    },
  };
}
