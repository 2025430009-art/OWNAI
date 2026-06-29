import { randomUUID } from 'crypto';
import { scheduleMemoryExtraction } from '../../ai/memoryEngine.js';
import { logUsage } from '../../db/index.js';
import { logger } from '../../utils/logger.js';
import { writeThinkingSseEvent } from '../../services/thinkingGenerationService.js';
import { createSndMessage } from './createSndMessage.js';
import { prepareGenerationFromRequest } from './prepareGeneration.js';
import { deliverMessages, enqueueDelivery } from '../agent/deliverMessages.js';
import { forwardAgentEvent } from '../agent/agentSubscriber.js';
import { resolveChatKey } from '../storage/chatMessageStore.js';
import {
  createOutputChannel,
  pushOutputEvent,
  markOutputDone,
} from '../bridge/outputQueue.js';
import { toView } from './toView.js';

async function handleSendMessage(req, res, payload, options = {}) {
  const startTime = Date.now();
  const correlationId = options.correlationId || randomUUID();
  const stream = payload.stream !== false;
  const sessionId = req.headers['x-session-id']?.toString()
    || payload.sessionId
    || payload.session_id;

  const prepared = await prepareGenerationFromRequest(req, payload);
  const { shaped, finalPrompt, dbUserId, generationParams, meta } = prepared;

  const chatKey = resolveChatKey(req.user?.id, sessionId);
  const sndMessage = createSndMessage(finalPrompt, { correlationId });

  const job = enqueueDelivery({
    correlationId,
    chatKey,
    userPrompt: finalPrompt,
    generationParams,
    userId: req.user?.id ?? null,
    sessionId,
  });

  createOutputChannel(correlationId);
  pushOutputEvent(correlationId, toView({
    type: 'meta',
    correlationId,
    command: 'send_message',
    algorithm_id: meta.algorithm_id,
  }));

  const onAgentEvent = (event) => {
    const view = forwardAgentEvent(correlationId, event);
    if (stream && res && !res.writableEnded && view) {
      writeThinkingSseEvent(res, event);
    }
  };

  if (stream && res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Correlation-Id', correlationId);

    if (meta.algorithm_id) {
      writeThinkingSseEvent(res, { type: 'meta', algorithm_id: meta.algorithm_id });
    }
  }

  try {
    const result = await deliverMessages(job, { onEvent: onAgentEvent });

    scheduleMemoryExtraction(finalPrompt, result?.text || '', dbUserId);

    await logUsage({
      userId: req.user?.id ?? null,
      endpoint: '/api/v1/chat/command',
      promptTokens: finalPrompt.length,
      completionTokens: (result?.text || '').length,
      modelKey: payload.model_key || 'default',
      durationMs: Date.now() - startTime,
    }).catch((err) => logger.warn('Usage log failed', { error: err.message }));

    if (stream && res) {
      res.write('data: [DONE]\n\n');
      res.end();
      return { correlationId, result, sndMessage };
    }

    markOutputDone(correlationId);

    return {
      success: true,
      correlationId,
      output: result?.text || '',
      thinking: result?.thinking || '',
      confidence: result?.confidence != null
        ? { score: result.confidence, reasoning: null }
        : null,
      meta: {
        duration_ms: Date.now() - startTime,
        model_key: payload.model_key || 'default',
        reasoning_mode: result?.mode,
        ...meta,
      },
      sndMessage,
    };
  } catch (error) {
    if (stream && res && !res.headersSent) {
      throw error;
    }
    if (stream && res && !res.writableEnded) {
      writeThinkingSseEvent(res, {
        type: 'text',
        token: 'Sorry, an error occurred while generating a response.',
      });
      res.write('data: [DONE]\n\n');
      res.end();
      return { correlationId, error: error.message };
    }
    throw error;
  }
}

/** Route chat commands (SimpleX processChatCommand). */
export async function processChatCommand(req, res, command) {
  const { type, payload = {} } = command;

  switch (type) {
    case 'send_message':
      return handleSendMessage(req, res, payload, command.options);
    case 'ping':
      return { success: true, pong: true };
    default:
      const err = new Error(`Unknown chat command: ${type}`);
      err.status = 400;
      throw err;
  }
}

/** Non-streaming helper for tests/CLI. */
export async function processSendMessage(req, payload) {
  return handleSendMessage(req, null, { ...payload, stream: false });
}
