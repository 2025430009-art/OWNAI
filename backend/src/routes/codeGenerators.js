import { Router } from 'express';
import { z } from 'zod';
import { inferenceAuth } from '../middleware/auth.js';
import { inferenceRateLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import { CODE_GENERATORS } from '../data/codeGenerators.js';
import { generateCode } from '../services/codeGeneratorService.js';
import { logUsage } from '../db/index.js';
import { logger } from '../utils/logger.js';

const router = Router();

const codeGenerateSchema = z.object({
  prompt: z.string().min(1, 'prompt is required').max(8000),
  max_tokens: z.number().int().min(64).max(4096).optional().default(768),
  temperature: z.number().min(0).max(2).optional(),
  model_key: z.string().optional(),
  model_src: z.string().optional(),
  stream: z.boolean().optional().default(false),
});

router.get('/', (_req, res) => {
  res.json({
    success: true,
    generators: CODE_GENERATORS.map(({ id, name, description, language, extension, examples, temperature }) => ({
      id,
      name,
      description,
      language,
      extension,
      examples,
      temperature,
    })),
  });
});

router.get('/:id', (req, res) => {
  const generator = CODE_GENERATORS.find((g) => g.id === req.params.id);
  if (!generator) {
    return res.status(404).json({ error: 'Code generator not found' });
  }
  const { id, name, description, language, extension, examples, temperature } = generator;
  return res.json({
    success: true,
    generator: { id, name, description, language, extension, examples, temperature },
  });
});

router.post('/:id/generate', inferenceAuth, inferenceRateLimiter, validate(codeGenerateSchema), async (req, res, next) => {
  const { prompt, max_tokens, temperature, model_key, model_src, stream } = req.validated;
  const startTime = Date.now();

  try {
    const result = await generateCode({
      generatorId: req.params.id,
      prompt,
      max_tokens,
      temperature,
      model_key,
      model_src,
      stream,
    });

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.write(`data: ${JSON.stringify({
        meta: {
          generator_id: result.generator.id,
          language: result.generator.language,
          extension: result.generator.extension,
        },
      })}\n\n`);

      for await (const token of result.run.tokenStream) {
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      res.end();

      await logUsage({
        userId: req.user?.id ?? null,
        endpoint: `/api/v1/code-generators/${req.params.id}/generate`,
        promptTokens: prompt.length,
        completionTokens: 0,
        modelKey: model_key || 'default',
        durationMs: Date.now() - startTime,
      }).catch((err) => logger.warn('Usage log failed', { error: err.message }));

      return;
    }

    await logUsage({
      userId: req.user?.id ?? null,
      endpoint: `/api/v1/code-generators/${req.params.id}/generate`,
      promptTokens: prompt.length,
      completionTokens: result.output.length,
      modelKey: model_key || 'default',
      durationMs: Date.now() - startTime,
    }).catch((err) => logger.warn('Usage log failed', { error: err.message }));

    res.json({
      success: true,
      output: result.output,
      meta: {
        ...result.meta,
        duration_ms: Date.now() - startTime,
        model_key: model_key || 'default',
      },
    });
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ error: error.message });
    }
    return next(error);
  }
});

export default router;
