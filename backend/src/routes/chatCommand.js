import { Router } from 'express';
import { z } from 'zod';
import { inferenceAuth } from '../middleware/auth.js';
import { inferenceRateLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import { execChatCommand } from '../chat/core/execChatCommand.js';
import {
  getOutputChannel,
  subscribeOutput,
  drainOutputChannel,
} from '../chat/bridge/outputQueue.js';

const router = Router();

const commandSchema = z.object({
  type: z.enum(['send_message', 'ping']),
  payload: z.record(z.unknown()).optional().default({}),
  options: z.object({
    correlationId: z.string().uuid().optional(),
  }).optional(),
});

const sendMessagePayloadSchema = z.object({
  prompt: z.string().min(1),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
  })).optional(),
  max_tokens: z.number().int().min(1).max(8192).optional(),
  temperature: z.number().min(0).max(2).optional(),
  model_key: z.string().optional(),
  model_src: z.string().optional(),
  stream: z.boolean().optional().default(true),
  algorithm_id: z.string().optional(),
  use_rag: z.boolean().optional(),
  reasoning_mode: z.string().optional(),
  enable_thinking: z.boolean().optional(),
  sessionId: z.string().optional(),
  session_id: z.string().optional(),
});

router.get('/', (_req, res) => {
  res.json({
    success: true,
    endpoint: '/api/v1/chat-bridge/command',
    description: 'OWNAI chat bridge — execChatCommand entry (SimpleX-style pipeline).',
    commands: ['send_message', 'ping'],
    receive: 'GET /api/v1/chat-bridge/receive/:correlationId',
    flow: [
      'bridge → execChatCommand → processChatCommand → deliverMessages → agent → outputQ',
    ],
  });
});

router.post('/command', inferenceAuth, inferenceRateLimiter, validate(commandSchema), async (req, res, next) => {
  const command = req.validated;

  if (command.type === 'send_message') {
    const parsed = sendMessagePayloadSchema.safeParse(command.payload);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid send_message payload', details: parsed.error.flatten() });
    }
    command.payload = parsed.data;
  }

  try {
    const result = await execChatCommand(req, res, command);
    if (!res.headersSent && result) {
      res.json({ success: true, ...result });
    }
  } catch (error) {
    next(error);
  }
});

router.get('/receive/:correlationId', inferenceAuth, (req, res) => {
  const { correlationId } = req.params;
  const channel = getOutputChannel(correlationId);

  if (!channel) {
    return res.status(404).json({ error: 'Unknown or expired correlation id' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  for (const event of channel.events) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  if (channel.done) {
    res.write('data: [DONE]\n\n');
    res.end();
    drainOutputChannel(correlationId);
    return;
  }

  const unsubscribe = subscribeOutput(correlationId, (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
    const ch = getOutputChannel(correlationId);
    if (ch?.done) {
      res.write('data: [DONE]\n\n');
      res.end();
      unsubscribe();
      drainOutputChannel(correlationId);
    }
  });

  req.on('close', () => {
    unsubscribe();
  });
});

export default router;
