import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { validate, generateSchema } from '../middleware/validate.js';
import { optionalAuth } from '../middleware/auth.js';
import { modelManager } from '../services/modelManager.js';
import { logUsage } from '../db/index.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * @openapi
 * /api/v1/generate:
 *   post:
 *     summary: Generate text completion
 *     tags: [Inference]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [prompt]
 *             properties:
 *               prompt:
 *                 type: string
 *               max_tokens:
 *                 type: integer
 *                 default: 100
 *               temperature:
 *                 type: number
 *                 default: 0.7
 *               model_key:
 *                 type: string
 *               model_src:
 *                 type: string
 *               stream:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Generated text
 *       400:
 *         description: Validation error
 */
router.post('/', optionalAuth, validate(generateSchema), async (req, res, next) => {
  const { prompt, max_tokens, temperature, model_key, model_src, stream } = req.validated;
  const startTime = Date.now();

  try {
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const run = await modelManager.generateStream(prompt, {
        max_tokens,
        temperature,
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

    const output = await modelManager.generate(prompt, {
      max_tokens,
      temperature,
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
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
