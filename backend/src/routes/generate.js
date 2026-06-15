import { Router } from 'express';
import { validate, generateSchema } from '../middleware/validate.js';
import { optionalAuth } from '../middleware/auth.js';
import { modelManager } from '../services/modelManager.js';
import { applyAlgorithm } from '../services/algorithmService.js';
import { logUsage } from '../db/index.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.post('/', optionalAuth, validate(generateSchema), async (req, res, next) => {
  const {
    prompt,
    max_tokens,
    temperature,
    model_key,
    model_src,
    stream,
    algorithm_id,
  } = req.validated;

  const startTime = Date.now();
  const shaped = applyAlgorithm(algorithm_id, prompt);
  const finalPrompt = shaped.prompt;
  const finalTemperature = temperature ?? shaped.temperature ?? 0.7;

  try {
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      if (shaped.meta.algorithm_id) {
        res.write(`data: ${JSON.stringify({ meta: shaped.meta })}\n\n`);
      }

      const run = await modelManager.generateStream(finalPrompt, {
        max_tokens,
        temperature: finalTemperature,
        modelKey: model_key,
        modelSrc: model_src,
      });

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

    const output = await modelManager.generate(finalPrompt, {
      max_tokens,
      temperature: finalTemperature,
      modelKey: model_key,
      modelSrc: model_src,
    });

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
