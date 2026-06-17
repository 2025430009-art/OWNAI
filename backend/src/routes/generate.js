import { Router } from 'express';
import { validate, generateSchema } from '../middleware/validate.js';
import { inferenceAuth } from '../middleware/auth.js';
import { inferenceRateLimiter } from '../middleware/rateLimiter.js';
import { applyAlgorithm } from '../services/algorithmService.js';
import { buildConversationHistory } from '../utils/conversationHistory.js';
import { buildRagContext, augmentPromptWithRag, buildRagSystemPrompt } from '../rag/ragChain.js';
import { resolveRagNamespace } from '../rag/namespace.js';
import { applyResearchChatAugmentation } from '../research/ragIntegration.js';
import { enrichWithResearchContext } from '../research/researchChatContext.js';
import {
  runThinkingGeneration,
  streamThinkingToResponse,
  writeThinkingSseEvent,
} from '../services/thinkingGenerationService.js';
import { logUsage } from '../db/index.js';
import { logger } from '../utils/logger.js';
import { resolveDbUserId } from '../services/thinkingLogService.js';
import {
  buildMemoryContext,
  applyMemoryPrefixToHistory,
  scheduleMemoryExtraction,
} from '../ai/memoryEngine.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    success: true,
    endpoint: '/api/v1/generate',
    method: 'POST',
    aliases: ['/api/v1/chat'],
    description: 'OWNAI text generation — supports RAG, streaming SSE, and thinking modes.',
    health: '/api/v1/health',
    docs: '/api-docs',
    hint: 'Send POST with JSON body { "prompt": "...", "stream": true, "use_rag": true }.',
    example: {
      prompt: 'Summarize my uploaded document',
      stream: true,
      use_rag: true,
      max_tokens: 512,
      enable_thinking: true,
    },
  });
});

async function handleGenerate(req, res, next) {
  const {
    prompt,
    messages,
    max_tokens,
    temperature,
    model_key,
    model_src,
    stream,
    algorithm_id,
    use_rag,
    reasoning_mode,
    enable_thinking,
  } = req.validated;

  const startTime = Date.now();
  const shaped = applyAlgorithm(algorithm_id, prompt);
  let finalPrompt = shaped.prompt;

  try {
    const researchPrefix = await enrichWithResearchContext(req, finalPrompt).catch(() => null);
    if (researchPrefix) {
      finalPrompt = researchPrefix + finalPrompt;
    }

    const ragNamespace = resolveRagNamespace(req);
    const ragContext = ragNamespace
      ? await buildRagContext(finalPrompt, 4, ragNamespace).catch(() => null)
      : null;
    let conversationHistory = augmentPromptWithRag(finalPrompt, ragContext, messages || []);

    if (req.user?.id) {
      conversationHistory = await applyResearchChatAugmentation(
        conversationHistory,
        finalPrompt,
        req.user.id,
      ).catch(() => conversationHistory);
    }

    const dbUserId = resolveDbUserId(req);
    if (dbUserId) {
      const memoryPrefix = await buildMemoryContext(finalPrompt, dbUserId).catch(() => '');
      conversationHistory = applyMemoryPrefixToHistory(conversationHistory, memoryPrefix);
    }

    const thinkingContext = {
      hasResearchContext: Boolean(researchPrefix),
      isResearch: Boolean(researchPrefix),
      ragContext: ragContext || '',
      ragSystemPrompt: buildRagSystemPrompt(ragContext),
    };

    const generationParams = {
      prompt: finalPrompt,
      history: conversationHistory,
      maxTokens: max_tokens,
      temperature: temperature ?? shaped.temperature ?? 0.7,
      modelKey: model_key,
      modelSrc: model_src,
      reasoningMode: enable_thinking ? reasoning_mode : 'direct',
      context: thinkingContext,
    };

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      if (shaped.meta.algorithm_id) {
        writeThinkingSseEvent(res, { type: 'meta', algorithm_id: shaped.meta.algorithm_id });
      }

      const streamResult = await streamThinkingToResponse(res, generationParams);

      scheduleMemoryExtraction(finalPrompt, streamResult?.text || '', dbUserId);

      await logUsage({
        userId: req.user?.id ?? null,
        endpoint: '/api/v1/generate',
        promptTokens: prompt.length,
        completionTokens: 0,
        modelKey: model_key || 'default',
        durationMs: Date.now() - startTime,
      }).catch((err) => logger.warn('Usage log failed', { error: err.message }));

      return;
    }

    let output = '';
    let thinking = '';
    let confidence = null;
    let meta = {};

    const result = await runThinkingGeneration({
      ...generationParams,
      onEvent: (event) => {
        if (event.type === 'text') output += event.token;
        if (event.type === 'thinking') thinking += event.token;
        if (event.type === 'text_replace') output = event.text;
        if (event.type === 'thinking_replace') thinking = event.text;
        if (event.type === 'confidence') confidence = { score: event.score, reasoning: event.reasoning };
        if (event.type === 'meta') meta = { ...meta, ...event };
      },
    });

    output = result.text || output;
    thinking = result.thinking || thinking;

    scheduleMemoryExtraction(finalPrompt, output, dbUserId);

    await logUsage({
      userId: req.user?.id ?? null,
      endpoint: '/api/v1/generate',
      promptTokens: prompt.length,
      completionTokens: output.length,
      modelKey: model_key || 'default',
      durationMs: Date.now() - startTime,
    }).catch((err) => logger.warn('Usage log failed', { error: err.message }));

    res.json({
      success: true,
      output,
      thinking,
      confidence,
      meta: {
        duration_ms: Date.now() - startTime,
        model_key: model_key || 'default',
        reasoning_mode: result.mode,
        ...shaped.meta,
        ...meta,
      },
    });
  } catch (error) {
    if (!res.headersSent) {
      return next(error);
    }
    writeThinkingSseEvent(res, {
      type: 'text',
      token: 'Sorry, an error occurred while generating a response.',
    });
    writeThinkingSseEvent(res, {
      type: 'confidence',
      score: 10,
      reasoning: error.message,
    });
    res.write('data: [DONE]\n\n');
    res.end();
  }
}

router.post('/', inferenceAuth, inferenceRateLimiter, validate(generateSchema), handleGenerate);

export default router;
