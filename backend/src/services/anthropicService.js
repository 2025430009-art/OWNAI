import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL = 'claude-sonnet-4-6';
const ANTHROPIC_BETA = 'interleaved-thinking-2025-05-14';

export function isAnthropicAvailable() {
  return Boolean(config.anthropic?.apiKey);
}

/**
 * @param {Array<{ role: string, content: string }>} history
 * @returns {{ system: string|null, messages: Array<{ role: 'user'|'assistant', content: string }> }}
 */
export function mapHistoryToAnthropicMessages(history = []) {
  let system = null;
  const messages = [];

  for (const turn of history) {
    if (turn.role === 'system') {
      system = system ? `${system}\n\n${turn.content}` : turn.content;
      continue;
    }
    if (turn.role === 'user' || turn.role === 'assistant') {
      messages.push({ role: turn.role, content: turn.content });
    }
  }

  return { system, messages };
}

/**
 * Stream Anthropic messages with interleaved thinking.
 * Emits events: { type: 'thinking'|'text', token: string }
 * @param {object} params
 * @param {() => AsyncGenerator<object>} params.onEvent - not used, events via callback
 */
export async function streamAnthropicMessages({
  messages,
  system,
  maxTokens = 4096,
  temperature = 0.4,
  enableThinking = true,
  thinkingBudgetTokens,
  onEvent,
}) {
  const apiKey = config.anthropic?.apiKey;
  if (!apiKey) {
    throw new Error('Anthropic API key is not configured on the server');
  }

  const body = {
    model: ANTHROPIC_MODEL,
    max_tokens: maxTokens,
    temperature,
    stream: true,
    messages,
  };

  if (system) {
    body.system = system;
  }

  if (enableThinking) {
    body.thinking = {
      type: 'enabled',
      budget_tokens: thinkingBudgetTokens ?? config.anthropic.thinkingBudgetTokens,
    };
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': ANTHROPIC_BETA,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    logger.warn('Anthropic API error', { status: response.status, body: errText.slice(0, 500) });
    throw new Error(`Anthropic API error (${response.status})`);
  }

  if (!response.body) {
    throw new Error('Anthropic streaming body unavailable');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentBlockType = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let lineBreakIndex = buffer.indexOf('\n');
    while (lineBreakIndex >= 0) {
      const line = buffer.slice(0, lineBreakIndex).trim();
      buffer = buffer.slice(lineBreakIndex + 1);
      lineBreakIndex = buffer.indexOf('\n');

      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;

      let event;
      try {
        event = JSON.parse(payload);
      } catch {
        continue;
      }

      if (event.type === 'content_block_start') {
        currentBlockType = event.content_block?.type || null;
        continue;
      }

      if (event.type === 'content_block_delta') {
        const delta = event.delta || {};
        if (delta.type === 'thinking_delta' && delta.thinking) {
          onEvent?.({ type: 'thinking', token: delta.thinking });
        } else if (delta.type === 'text_delta' && delta.text) {
          onEvent?.({ type: 'text', token: delta.text });
        } else if (currentBlockType === 'thinking' && delta.text) {
          onEvent?.({ type: 'thinking', token: delta.text });
        } else if (currentBlockType === 'text' && delta.text) {
          onEvent?.({ type: 'text', token: delta.text });
        }
        continue;
      }

      if (event.type === 'content_block_stop') {
        currentBlockType = null;
      }
    }
  }
}

function parseAnthropicContentBlocks(content = []) {
  let thinking = '';
  let text = '';

  for (const block of content) {
    if (block.type === 'thinking') {
      thinking += block.thinking || '';
    } else if (block.type === 'text') {
      text += block.text || '';
    }
  }

  return { thinking, text };
}

/**
 * Non-streaming Anthropic call with optional extended thinking blocks.
 */
export async function callAnthropicMessages({
  messages,
  system,
  maxTokens = 4096,
  temperature = 0.4,
  enableThinking = true,
  thinkingBudgetTokens,
}) {
  const apiKey = config.anthropic?.apiKey;
  if (!apiKey) {
    throw new Error('Anthropic API key is not configured on the server');
  }

  const body = {
    model: ANTHROPIC_MODEL,
    max_tokens: maxTokens,
    temperature,
    stream: false,
    messages,
  };

  if (system) {
    body.system = system;
  }

  if (enableThinking) {
    body.thinking = {
      type: 'enabled',
      budget_tokens: thinkingBudgetTokens ?? config.anthropic.thinkingBudgetTokens,
    };
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': ANTHROPIC_BETA,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    logger.warn('Anthropic API error', { status: response.status, body: errText.slice(0, 500) });
    throw new Error(`Anthropic API error (${response.status})`);
  }

  const data = await response.json();
  const { thinking, text } = parseAnthropicContentBlocks(data.content);

  return {
    thinking,
    text,
    usage: data.usage || null,
    raw: data,
  };
}

export { ANTHROPIC_MODEL, ANTHROPIC_BETA };
