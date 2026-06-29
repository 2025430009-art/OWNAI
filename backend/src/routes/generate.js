import { Router } from 'express';
import { validate, generateSchema } from '../middleware/validate.js';
import { inferenceAuth } from '../middleware/auth.js';
import { inferenceRateLimiter } from '../middleware/rateLimiter.js';
import { execChatCommand } from '../chat/core/execChatCommand.js';
import { writeThinkingSseEvent } from '../services/thinkingGenerationService.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    success: true,
    endpoint: '/api/v1/generate',
    method: 'POST',
    aliases: ['/api/v1/chat'],
    pipeline: 'bridge → execChatCommand → processChatCommand → agent → outputQ',
    bridge: '/api/v1/chat-bridge/command',
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
  try {
    await execChatCommand(req, res, {
      type: 'send_message',
      payload: req.validated,
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
