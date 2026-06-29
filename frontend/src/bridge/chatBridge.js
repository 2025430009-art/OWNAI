/**
 * Foreign bridge — unified chat send/receive for web, mobile, and CLI.
 * Maps to SimpleX chatSendCmdRetry / chatRecvMsgWait.
 */
import { apiUrl, getApiBase } from '../utils/apiConfig.js';
import { getOwnaiSessionId } from '../utils/sessionId.js';
import { AuthRequiredError } from '../utils/authErrors.js';
import { consumeThinkingSse } from '../utils/thinkingStreamClient.js';

const DEFAULT_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

function bridgeFetch(path, options = {}) {
  const sessionId = options.sessionId || getOwnaiSessionId();
  const headers = new Headers(options.headers || {});
  if (sessionId && !headers.has('x-session-id')) {
    headers.set('x-session-id', sessionId);
  }
  return fetch(apiUrl(path), {
    credentials: 'include',
    ...options,
    headers,
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function parseError(response) {
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    throw new AuthRequiredError(data.error || 'Authentication required');
  }
  throw new Error(data.error || data.message || `Request failed: ${response.status}`);
}

/**
 * Send a chat command with retry (chatSendCmdRetry).
 * Returns raw Response for streaming, or JSON for non-streaming.
 */
export async function chatSendCmdRetry(command, {
  retries = DEFAULT_RETRIES,
  sessionId,
} = {}) {
  let lastError;

  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await bridgeFetch('/api/v1/chat-bridge/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(command),
        sessionId,
      });

      if (response.ok) return response;
      if (response.status === 401) {
        await parseError(response);
      }
      if (response.status >= 500 && attempt < retries - 1) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
      await parseError(response);
    } catch (error) {
      lastError = error;
      if (error instanceof AuthRequiredError || attempt >= retries - 1) throw error;
      await sleep(RETRY_DELAY_MS * (attempt + 1));
    }
  }

  throw lastError || new Error('Chat command failed');
}

/** Convenience wrapper for send_message commands. */
export async function chatSendMessage(payload, options = {}) {
  return chatSendCmdRetry({
    type: 'send_message',
    payload,
  }, options);
}

/**
 * Wait for streamed view events (chatRecvMsgWait).
 * Works with SSE from send_message stream=true or /chat/receive/:correlationId.
 */
export async function chatRecvMsgWait(response, handlers = {}) {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('text/event-stream')) {
    return consumeThinkingSse(response, {
      onText: handlers.onText,
      onThinking: handlers.onThinking,
      onConfidence: handlers.onConfidence,
      onMeta: handlers.onMeta,
      onThinkingResult: handlers.onThinkingResult,
    });
  }

  const data = await response.json();
  handlers.onText?.(data.output || '');
  return {
    text: data.output || '',
    thinking: data.thinking || '',
    confidence: data.confidence,
    meta: data.meta,
    correlationId: data.correlationId,
  };
}

/** Subscribe to outputQ by correlation id (decoupled receive path). */
export async function chatRecvByCorrelation(correlationId, handlers = {}) {
  const response = await bridgeFetch(`/api/v1/chat-bridge/receive/${correlationId}`);
  if (!response.ok) {
    await parseError(response);
  }
  return chatRecvMsgWait(response, handlers);
}

export function getBridgeApiBase() {
  return getApiBase();
}
