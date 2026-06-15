import { Router } from 'express';
import { z } from 'zod';
import { modelManager } from '../services/modelManager.js';
import { inferenceAuth } from '../middleware/auth.js';
import { inferenceRateLimiter } from '../middleware/rateLimiter.js';
import { logUsage } from '../db/index.js';
import { logger } from '../utils/logger.js';

const router = Router();

const chatCompletionSchema = z.object({
  model: z.string().optional().default('default'),
  messages: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string(),
      })
    )
    .min(1),
  max_tokens: z.number().int().min(1).max(4096).optional().default(100),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  stream: z.boolean().optional().default(false),
});

function extractPrompt(messages) {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  return lastUser?.content || messages[messages.length - 1].content;
}

/**
 * @openapi
 * /v1/chat/completions:
 *   post:
 *     summary: OpenAI-compatible chat completions
 *     tags: [OpenAI Compatible]
 */
router.post('/chat/completions', inferenceAuth, inferenceRateLimiter, async (req, res, next) => {
  const result = chatCompletionSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: {
        message: 'Invalid request',
        type: 'invalid_request_error',
        param: null,
        code: null,
      },
    });
  }

  const { model, messages, max_tokens, temperature, stream } = result.data;
  const prompt = extractPrompt(messages);
  const startTime = Date.now();
  const completionId = `chatcmpl-${Date.now()}`;

  try {
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const run = await modelManager.generateStream(prompt, {
        max_tokens,
        temperature,
        modelKey: model,
      });

      for await (const token of run.tokenStream) {
        const chunk = {
          id: completionId,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [
            {
              index: 0,
              delta: { content: token },
              finish_reason: null,
            },
          ],
        };
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }

      res.write(
        `data: ${JSON.stringify({
          id: completionId,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
        })}\n\n`
      );
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const output = await modelManager.generate(prompt, {
      max_tokens,
      temperature,
      modelKey: model,
    });

    await logUsage({
      userId: req.user?.id ?? null,
      endpoint: '/v1/chat/completions',
      promptTokens: prompt.length,
      completionTokens: output.length,
      modelKey: model,
      durationMs: Date.now() - startTime,
    }).catch((err) => logger.warn('Usage log failed', { error: err.message }));

    res.json({
      id: completionId,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: output },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: prompt.length,
        completion_tokens: output.length,
        total_tokens: prompt.length + output.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /v1/models:
 *   get:
 *     summary: OpenAI-compatible model list
 *     tags: [OpenAI Compatible]
 */
router.get('/models', (_req, res) => {
  res.json({
    object: 'list',
    data: [
      {
        id: 'default',
        object: 'model',
        created: 1700000000,
        owned_by: 'own-ai',
      },
      {
        id: 'llama-3.2-1b-instruct',
        object: 'model',
        created: 1700000000,
        owned_by: 'qvac',
      },
    ],
  });
});

export default router;
