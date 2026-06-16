import { Router } from 'express';
import { inferenceAuth } from '../middleware/auth.js';
import { inferenceRateLimiter, compareRateLimiter } from '../middleware/rateLimiter.js';
import { validate, thinkSchema, detectModeSchema, compareModesSchema, saveMemorySchema } from '../middleware/validate.js';
import { buildConversationHistory } from '../utils/conversationHistory.js';
import {
  resolveTrustedTurns,
  persistTrustedExchange,
} from '../utils/trustedConversation.js';
import {
  runThinkingGeneration,
  writeThinkingSseEvent,
} from '../services/thinkingGenerationService.js';
import {
  isAnthropicAvailable,
  callAnthropicMessages,
  streamAnthropicMessages,
} from '../services/anthropicService.js';
import {
  resolveDbUserId,
  saveThinkingLog,
  listThinkingLogs,
  getThinkingLogById,
} from '../services/thinkingLogService.js';
import { logUsage } from '../db/index.js';
import { logger } from '../utils/logger.js';
import * as thinkingEngine from '../ai/thinkingEngine.js';
import { executeReActLoop, getToolDefinitions } from '../ai/toolEngine.js';
import {
  selfRefineLoop,
  scoreResponseConfidence,
  detectKnowledgeGaps,
} from '../ai/refinementEngine.js';
import {
  buildMemoryContext,
  applyMemoryPrefixToHistory,
  scheduleMemoryExtraction,
  listMemories,
  saveMemory,
  forgetMemory,
  getKnowledgeGraph,
  MEMORY_TYPES,
} from '../ai/memoryEngine.js';

const {
  THINKING_MODES,
  ALL_THINKING_MODES,
  detectBestMode,
  buildPromptForMode,
  buildReasoningSystemPrompt,
  parseThinkingResponse,
  normalizeThinkingOutput,
  buildModeMeta,
} = thinkingEngine;

const router = Router();

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MODE_ALIASES = {
  direct: THINKING_MODES.DIRECT,
  cot: THINKING_MODES.COT,
  chain_of_thought: THINKING_MODES.COT,
  tot: THINKING_MODES.TOT,
  tree_of_thoughts: THINKING_MODES.TOT,
  react: THINKING_MODES.REACT,
  self_refine: THINKING_MODES.SELF_REFINE,
  human_think: THINKING_MODES.HUMAN_THINK,
  extended: THINKING_MODES.EXTENDED,
  socratic: THINKING_MODES.SOCRATIC,
  debate: THINKING_MODES.DEBATE,
};

export function normalizeModeInput(input) {
  const key = String(input || '').trim().toLowerCase();
  if (ALL_THINKING_MODES.includes(key)) return key;
  if (MODE_ALIASES[key]) return MODE_ALIASES[key];
  return null;
}

function resolveMode(message, requestedMode, context) {
  if (!requestedMode || requestedMode === 'auto') {
    const detected = detectBestMode(message, context);
    return { mode: detected.mode, detectedMode: detected.mode, meta: detected };
  }

  const normalized = normalizeModeInput(requestedMode);
  if (!normalized) {
    const err = new Error(`Invalid mode: ${requestedMode}`);
    err.status = 400;
    throw err;
  }

  return {
    mode: normalized,
    detectedMode: detectBestMode(message, context).mode,
    meta: { mode: normalized, confidence: 95, reason: 'Mode explicitly set in request' },
  };
}

function buildHistoryFromContext(context, message) {
  const turns = context._serverTurns ?? [];
  let history = buildConversationHistory(turns, message);
  if (context.memoryPrefix) {
    history = applyMemoryPrefixToHistory(history, context.memoryPrefix);
  }
  return history;
}

function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(String(text).length / 4);
}

async function runExtendedAnthropicThinking({
  builtPrompt,
  reasoningSystem,
  stream,
  onEvent,
}) {
  if (!isAnthropicAvailable()) {
    const err = new Error('Anthropic API key is not configured — extended thinking requires Anthropic');
    err.status = 503;
    throw err;
  }

  const messages = [{ role: 'user', content: builtPrompt }];
  const system = reasoningSystem;

  if (stream) {
    let fullText = '';
    let fullThinking = '';

    await streamAnthropicMessages({
      messages,
      system,
      maxTokens: 16000,
      temperature: 0.4,
      enableThinking: true,
      thinkingBudgetTokens: 8000,
      onEvent: (event) => {
        if (event.type === 'thinking') fullThinking += event.token;
        else if (event.type === 'text') fullText += event.token;
        onEvent?.(event);
      },
    });

    const normalized = normalizeThinkingOutput(fullText, THINKING_MODES.EXTENDED);
    return {
      thinking_scratchpad: fullThinking || normalized.thinking,
      final_answer: normalized.answer || fullText,
      raw_response: fullText,
      parsed: normalized.structured,
      confidence: normalized.confidence ?? 70,
      tokens_used: estimateTokens(fullThinking) + estimateTokens(fullText),
    };
  }

  const response = await callAnthropicMessages({
    messages,
    system,
    maxTokens: 16000,
    temperature: 0.4,
    enableThinking: true,
    thinkingBudgetTokens: 8000,
  });

  const normalized = normalizeThinkingOutput(response.text, THINKING_MODES.EXTENDED);

  return {
    thinking_scratchpad: response.thinking || normalized.thinking,
    final_answer: normalized.answer || response.text,
    raw_response: response.text,
    parsed: normalized.structured,
    confidence: normalized.confidence ?? 70,
    tokens_used: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
      || estimateTokens(response.thinking) + estimateTokens(response.text),
  };
}

async function runReActThinking({
  message,
  context,
  tools,
  stream,
  onEvent,
  userId,
}) {
  const reactContext = {
    ...context,
    userId,
    history: buildHistoryFromContext(context, message),
  };

  const handleCycle = (cycle) => {
    onEvent?.({ type: 'react_cycle', cycle });
    if (cycle.thought) {
      onEvent?.({ type: 'thinking', token: `Cycle ${cycle.cycle} — Thought: ${cycle.thought}\n` });
    }
    if (cycle.action?.tool && cycle.action.tool !== 'none') {
      onEvent?.({
        type: 'tool_call',
        tool: cycle.action.tool,
        input: cycle.action.input,
        cycle: cycle.cycle,
      });
    }
    if (cycle.observation) {
      onEvent?.({
        type: 'tool_result',
        observation: cycle.observation,
        cycle: cycle.cycle,
      });
      onEvent?.({ type: 'thinking', token: `Observation: ${JSON.stringify(cycle.observation)}\n` });
    }
  };

  const reactResult = await executeReActLoop(message, reactContext, tools, 6, {
    onCycle: stream ? handleCycle : undefined,
  });

  const structured = {
    thinking_mode: 'react',
    cycles: reactResult.cycles,
    final_answer: reactResult.final_answer,
    tools_used: reactResult.tools_used,
    total_duration_ms: reactResult.total_duration_ms,
  };

  return {
    final_answer: reactResult.final_answer,
    thinking_scratchpad: JSON.stringify(structured, null, 2),
    parsed: structured,
    confidence: 75,
    raw_response: reactResult.final_answer,
    tokens_used: estimateTokens(JSON.stringify(reactResult)),
    tools_available: getToolDefinitions(tools),
  };
}

async function runSelfRefineThinking({
  message,
  context,
  stream,
  onEvent,
  scoreConfidence = false,
}) {
  const refineContext = {
    ...context,
    history: buildHistoryFromContext(context, message),
  };

  const handleIteration = (iteration) => {
    onEvent?.({ type: 'refine_iteration', iteration });
    onEvent?.({
      type: 'thinking',
      token: `Iteration ${iteration.iteration} — Score: ${iteration.score}/100\n`,
    });
    if (iteration.critique?.weaknesses?.length) {
      onEvent?.({
        type: 'thinking',
        token: `Weaknesses: ${iteration.critique.weaknesses.join('; ')}\n`,
      });
    }
    onEvent?.({ type: 'text_replace', text: iteration.draft });
    onEvent?.({
      type: 'confidence',
      score: iteration.score,
      reasoning: iteration.critique?.improvement_priority || null,
    });
  };

  const refineResult = await selfRefineLoop(message, refineContext, 3, {
    onIteration: stream ? handleIteration : undefined,
  });

  let confidenceDetail = null;
  if (scoreConfidence) {
    confidenceDetail = await scoreResponseConfidence(
      message,
      refineResult.final_answer,
      refineContext,
    );
  }

  const structured = {
    ...refineResult,
    confidence_detail: confidenceDetail,
  };

  return {
    final_answer: refineResult.final_answer,
    thinking_scratchpad: JSON.stringify(structured, null, 2),
    parsed: structured,
    confidence: refineResult.confidence_overall,
    confidence_detail: confidenceDetail,
    raw_response: refineResult.final_answer,
    tokens_used: estimateTokens(JSON.stringify(refineResult)),
  };
}

async function runStandardThinking({
  message,
  mode,
  context,
  tools,
  stream,
  onEvent,
}) {
  const enrichedContext = { ...context, tools };
  const history = buildHistoryFromContext(context, message);

  if (stream) {
    const result = await runThinkingGeneration({
      prompt: message,
      history,
      maxTokens: 4096,
      temperature: 0.4,
      reasoningMode: mode,
      context: enrichedContext,
      onEvent,
    });

    return {
      final_answer: result.text,
      thinking_scratchpad: result.thinking,
      parsed: result.structured,
      confidence: result.structured?.confidence_overall ?? null,
      raw_response: result.text,
      tokens_used: estimateTokens(result.text) + estimateTokens(result.thinking),
    };
  }

  let rawResponse = '';
  let thinkingScratchpad = '';
  let parsed = null;
  let confidence = null;

  const result = await runThinkingGeneration({
    prompt: message,
    history,
    maxTokens: 4096,
    temperature: 0.4,
    reasoningMode: mode,
    context: enrichedContext,
    onEvent: (event) => {
      if (event.type === 'text') rawResponse += event.token;
      if (event.type === 'thinking') thinkingScratchpad += event.token;
      if (event.type === 'text_replace') rawResponse = event.text;
      if (event.type === 'thinking_replace') thinkingScratchpad = event.text;
      if (event.type === 'confidence') confidence = event.score;
    },
  });

  rawResponse = result.text || rawResponse;
  thinkingScratchpad = result.thinking || thinkingScratchpad;
  parsed = result.structured || parseThinkingResponse(rawResponse, mode);
  confidence = confidence ?? parsed?.confidence_overall ?? null;

  return {
    final_answer: parsed?.final_answer || rawResponse,
    thinking_scratchpad: thinkingScratchpad,
    parsed,
    confidence,
    raw_response: rawResponse,
    tokens_used: estimateTokens(rawResponse) + estimateTokens(thinkingScratchpad),
  };
}

async function persistThinkingLog(req, payload) {
  const userId = resolveDbUserId(req);
  if (!userId) return null;

  try {
    return await saveThinkingLog({
      userId,
      message: payload.message,
      mode: payload.mode,
      detectedMode: payload.detectedMode,
      promptSent: payload.promptSent,
      rawResponse: payload.rawResponse,
      parsedResult: payload.parsedResult,
      confidence: payload.confidence,
      tokensUsed: payload.tokensUsed,
      durationMs: payload.durationMs,
    });
  } catch (error) {
    logger.warn('Failed to save thinking log', { error: error.message });
    return null;
  }
}

/**
 * POST /api/v1/think
 */
router.post('/', inferenceAuth, inferenceRateLimiter, validate(thinkSchema), async (req, res, next) => {
  const {
    message,
    mode,
    context,
    tools,
    stream,
    use_extended_thinking,
    session_id: sessionId,
  } = req.validated;

  const startTime = Date.now();

  try {
    const dbUserId = resolveDbUserId(req);
    const { turns, sessionKey, safeContext } = resolveTrustedTurns({
      userId: dbUserId,
      sessionId,
      context,
      message,
    });

    const enrichedContext = {
      ...safeContext,
      tools,
      _serverTurns: turns,
    };
    if (dbUserId) {
      enrichedContext.memoryPrefix = await buildMemoryContext(message, dbUserId).catch(() => '');
    }
    const { mode: resolvedMode, detectedMode, meta } = resolveMode(message, mode, enrichedContext);
    const builtPrompt = buildPromptForMode(resolvedMode, message, enrichedContext, tools);
    const reasoningSystem = buildReasoningSystemPrompt(resolvedMode);

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      writeThinkingSseEvent(res, buildModeMeta(
        { mode: resolvedMode, confidence: meta.confidence, reason: meta.reason, autoDetected: !mode || mode === 'auto' },
        { detected_mode: detectedMode, use_extended_thinking },
      ));

      let result;

      if (use_extended_thinking) {
        result = await runExtendedAnthropicThinking({
          builtPrompt,
          reasoningSystem,
          stream: true,
          onEvent: (event) => writeThinkingSseEvent(res, event),
        });

        writeThinkingSseEvent(res, {
          type: 'result',
          mode: resolvedMode,
          confidence: result.confidence,
          final_answer: result.final_answer,
          thinking_scratchpad: result.thinking_scratchpad,
          parsed: result.parsed,
        });
      } else if (resolvedMode === THINKING_MODES.REACT) {
        result = await runReActThinking({
          message,
          context: enrichedContext,
          tools,
          stream: true,
          userId: resolveDbUserId(req),
          onEvent: (event) => writeThinkingSseEvent(res, event),
        });

        writeThinkingSseEvent(res, {
          type: 'result',
          mode: resolvedMode,
          confidence: result.confidence,
          final_answer: result.final_answer,
          thinking_scratchpad: result.thinking_scratchpad,
          parsed: result.parsed,
          tools_used: result.parsed?.tools_used,
        });
      } else if (resolvedMode === THINKING_MODES.SELF_REFINE || resolvedMode === THINKING_MODES.HUMAN_THINK) {
        result = await runSelfRefineThinking({
          message,
          context: enrichedContext,
          stream: true,
          scoreConfidence: Boolean(safeContext.score_confidence),
          onEvent: (event) => writeThinkingSseEvent(res, event),
        });

        writeThinkingSseEvent(res, {
          type: 'result',
          mode: resolvedMode,
          confidence: result.confidence,
          final_answer: result.final_answer,
          thinking_scratchpad: result.thinking_scratchpad,
          parsed: result.parsed,
          score_progression: result.parsed?.score_progression,
          confidence_detail: result.confidence_detail,
        });
      } else {
        result = await runStandardThinking({
          message,
          mode: resolvedMode,
          context: enrichedContext,
          tools,
          stream: true,
          onEvent: (event) => writeThinkingSseEvent(res, event),
        });

        writeThinkingSseEvent(res, {
          type: 'result',
          mode: resolvedMode,
          confidence: result.confidence,
          final_answer: result.final_answer,
          thinking_scratchpad: result.thinking_scratchpad,
          parsed: result.parsed,
        });
      }

      scheduleMemoryExtraction(message, result.final_answer, dbUserId);
      persistTrustedExchange(sessionKey, message, result.final_answer);

      const saved = await persistThinkingLog(req, {
        message,
        mode: resolvedMode,
        detectedMode,
        promptSent: builtPrompt,
        rawResponse: result.raw_response,
        parsedResult: result.parsed,
        confidence: result.confidence,
        tokensUsed: result.tokens_used,
        durationMs: Date.now() - startTime,
      });

      if (saved?.id) {
        writeThinkingSseEvent(res, { type: 'log_saved', log_id: saved.id });
      }

      await logUsage({
        userId: resolveDbUserId(req),
        endpoint: '/api/v1/think',
        promptTokens: message.length,
        completionTokens: result.final_answer?.length || 0,
        modelKey: use_extended_thinking ? 'claude-sonnet-4-6' : 'thinking-engine',
        durationMs: Date.now() - startTime,
      }).catch(() => {});

      res.write('data: [DONE]\n\n');
      return res.end();
    }

    let result;

    if (use_extended_thinking) {
      result = await runExtendedAnthropicThinking({
        builtPrompt,
        reasoningSystem,
        stream: false,
      });
    } else if (resolvedMode === THINKING_MODES.REACT) {
      result = await runReActThinking({
        message,
        context: enrichedContext,
        tools,
        stream: false,
        userId: resolveDbUserId(req),
      });
    } else if (resolvedMode === THINKING_MODES.SELF_REFINE || resolvedMode === THINKING_MODES.HUMAN_THINK) {
      result = await runSelfRefineThinking({
        message,
        context: enrichedContext,
        stream: false,
        scoreConfidence: Boolean(safeContext.score_confidence),
      });
    } else {
      result = await runStandardThinking({
        message,
        mode: resolvedMode,
        context: enrichedContext,
        tools,
        stream: false,
      });
    }

    scheduleMemoryExtraction(message, result.final_answer, dbUserId);
    persistTrustedExchange(sessionKey, message, result.final_answer);

    const saved = await persistThinkingLog(req, {
      message,
      mode: resolvedMode,
      detectedMode,
      promptSent: builtPrompt,
      rawResponse: result.raw_response,
      parsedResult: result.parsed,
      confidence: result.confidence,
      tokensUsed: result.tokens_used,
      durationMs: Date.now() - startTime,
    });

    await logUsage({
      userId: resolveDbUserId(req),
      endpoint: '/api/v1/think',
      promptTokens: message.length,
      completionTokens: result.final_answer?.length || 0,
      modelKey: use_extended_thinking ? 'claude-sonnet-4-6' : 'thinking-engine',
      durationMs: Date.now() - startTime,
    }).catch(() => {});

    if (use_extended_thinking) {
      return res.json({
        success: true,
        thinking_scratchpad: result.thinking_scratchpad,
        final_answer: result.final_answer,
        mode: resolvedMode,
        detected_mode: detectedMode,
        confidence: result.confidence,
        parsed: result.parsed,
        log_id: saved?.id || null,
        duration_ms: Date.now() - startTime,
      });
    }

    return res.json({
      success: true,
      mode: resolvedMode,
      detected_mode: detectedMode,
      confidence: result.confidence,
      final_answer: result.final_answer,
      thinking: result.thinking_scratchpad,
      structured: result.parsed,
      log_id: saved?.id || null,
      duration_ms: Date.now() - startTime,
    });
  } catch (error) {
    if (res.headersSent) {
      writeThinkingSseEvent(res, { type: 'error', message: error.message });
      res.write('data: [DONE]\n\n');
      return res.end();
    }
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    return next(error);
  }
});

/**
 * POST /api/v1/think/detect-mode
 */
router.post('/detect-mode', inferenceAuth, validate(detectModeSchema), (req, res) => {
  const { message, context } = req.validated;
  const result = detectBestMode(message, context);
  res.json({
    success: true,
    mode: result.mode,
    confidence: result.confidence,
    reason: result.reason,
  });
});

/**
 * POST /api/v1/think/compare
 */
router.post('/compare', inferenceAuth, compareRateLimiter, validate(compareModesSchema), async (req, res, next) => {
  const { message, modes, context, tools, session_id: sessionId } = req.validated;
  const dbUserId = resolveDbUserId(req);
  const { turns, safeContext } = resolveTrustedTurns({
    userId: dbUserId,
    sessionId,
    context,
    message,
  });
  const enrichedContext = { ...safeContext, tools, _serverTurns: turns };

  try {
    const normalizedModes = modes.map((m) => {
      const resolved = normalizeModeInput(m);
      if (!resolved) {
        const err = new Error(`Invalid mode in compare list: ${m}`);
        err.status = 400;
        throw err;
      }
      return resolved;
    });

    const uniqueModes = [...new Set(normalizedModes)];

    const results = await Promise.all(uniqueModes.map(async (compareMode) => {
      const builtPrompt = buildPromptForMode(compareMode, message, enrichedContext, tools);
      const output = await runStandardThinking({
        message,
        mode: compareMode,
        context: enrichedContext,
        tools,
        stream: false,
      });

      return {
        mode: compareMode,
        answer: output.final_answer,
        confidence: output.confidence,
        thinking: output.thinking_scratchpad,
        structured: output.parsed,
        prompt_preview: builtPrompt.slice(0, 200),
      };
    }));

    res.json({
      success: true,
      message,
      results,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    return next(error);
  }
});

/**
 * GET /api/v1/think/memory/graph
 */
router.get('/memory/graph', inferenceAuth, async (req, res) => {
  const userId = resolveDbUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Authenticated user required for memory graph' });
  }

  const graph = await getKnowledgeGraph(userId);
  res.json({ success: true, ...graph });
});

/**
 * GET /api/v1/think/memory
 */
router.get('/memory', inferenceAuth, async (req, res) => {
  const userId = resolveDbUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Authenticated user required for memories' });
  }

  const type = req.query.type?.toString();
  if (type && !MEMORY_TYPES.includes(type)) {
    return res.status(400).json({ error: `Invalid type. Must be one of: ${MEMORY_TYPES.join(', ')}` });
  }

  const memories = await listMemories(userId, type || null);
  const grouped = memories.reduce((acc, memory) => {
    if (!acc[memory.type]) acc[memory.type] = [];
    acc[memory.type].push(memory);
    return acc;
  }, {});

  res.json({
    success: true,
    count: memories.length,
    memories,
    by_type: grouped,
  });
});

/**
 * POST /api/v1/think/memory
 */
router.post('/memory', inferenceAuth, validate(saveMemorySchema), async (req, res, next) => {
  const userId = resolveDbUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Authenticated user required to save memories' });
  }

  try {
    const { type, content, tags, confidence, expires_in_days } = req.validated;
    const memory = await saveMemory(userId, type, content, tags, confidence, { expires_in_days });
    res.status(201).json({ success: true, memory });
  } catch (error) {
    return next(error);
  }
});

/**
 * DELETE /api/v1/think/memory/:id
 */
router.delete('/memory/:id', inferenceAuth, async (req, res) => {
  const userId = resolveDbUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Authenticated user required to forget memories' });
  }

  if (!UUID_V4_REGEX.test(req.params.id)) {
    return res.status(400).json({ error: 'Invalid memory id' });
  }

  const memory = await forgetMemory(req.params.id, userId);
  if (!memory) {
    return res.status(404).json({ error: 'Memory not found' });
  }

  res.json({ success: true, forgotten: memory.id });
});

/**
 * GET /api/v1/think/logs
 */
router.get('/logs', inferenceAuth, async (req, res) => {
  const userId = resolveDbUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Authenticated user required for thinking logs' });
  }

  const logs = await listThinkingLogs(userId, 20);
  res.json({
    success: true,
    logs: logs.map((log) => ({
      id: log.id,
      message: log.message,
      mode: log.mode,
      confidence: log.confidence,
      created_at: log.created_at,
      tokens_used: log.tokens_used,
    })),
  });
});

/**
 * GET /api/v1/think/logs/:id
 */
router.get('/logs/:id', inferenceAuth, async (req, res) => {
  const userId = resolveDbUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Authenticated user required for thinking logs' });
  }

  if (!UUID_V4_REGEX.test(req.params.id)) {
    return res.status(400).json({ error: 'Invalid log id' });
  }

  const log = await getThinkingLogById(userId, req.params.id);
  if (!log) {
    return res.status(404).json({ error: 'Thinking log not found' });
  }

  res.json({
    success: true,
    log: {
      id: log.id,
      message: log.message,
      mode: log.mode,
      detected_mode: log.detected_mode,
      prompt_sent: log.prompt_sent,
      raw_response: log.raw_response,
      parsed_result: log.parsed_result,
      confidence: log.confidence,
      tokens_used: log.tokens_used,
      duration_ms: log.duration_ms,
      created_at: log.created_at,
    },
  });
});

export default router;
