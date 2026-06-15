import { Router } from 'express';
import { validate, generateSchema } from '../middleware/validate.js';
import { inferenceAuth } from '../middleware/auth.js';
import { inferenceRateLimiter } from '../middleware/rateLimiter.js';
import { modelManager } from '../services/modelManager.js';
import { applyAlgorithm } from '../services/algorithmService.js';
import { buildConversationHistory } from '../utils/conversationHistory.js';
import { buildRagContext, augmentPromptWithRag } from '../rag/ragChain.js';
import { logUsage } from '../db/index.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.post('/', inferenceAuth, inferenceRateLimiter, validate(generateSchema), async (req, res, next) => {
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
  } = req.validated;

  const startTime = Date.now();
  const shaped = applyAlgorithm(algorithm_id, prompt);
  const finalPrompt = shaped.prompt;
  const finalTemperature = temperature ?? shaped.temperature ?? 0.7;

  let conversationHistory;
  if (use_rag) {
    const ragContext = await buildRagContext(finalPrompt).catch(() => null);
    conversationHistory = augmentPromptWithRag(finalPrompt, ragContext, messages || []);
  } else {
    conversationHistory = buildConversationHistory(messages || [], finalPrompt);
  }
  const modelOptions = {
    max_tokens,
    temperature: finalTemperature,
    modelKey: model_key,
    modelSrc: model_src,
    history: conversationHistory,
  };

  try {
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      if (shaped.meta.algorithm_id) {
        res.write(`data: ${JSON.stringify({ meta: shaped.meta })}\n\n`);
      }

      const run = await modelManager.generateStream(finalPrompt, modelOptions);

      for await (const token of run.tokenStream) {
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      res.end();

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

    const output = await modelManager.generate(finalPrompt, modelOptions);

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
      meta: {
        duration_ms: Date.now() - startTime,
        model_key: model_key || 'default',
        ...shaped.meta,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
