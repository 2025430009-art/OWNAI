/**
 * Browser-side Anthropic fallback when the OWNAI backend is unreachable.
 * Requires VITE_ANTHROPIC_KEY at build time (GitHub secret — never commit keys).
 */

const ANTHROPIC_MODEL = 'claude-sonnet-4-6';

export function hasAnthropicDirect() {
  return Boolean(import.meta.env.VITE_ANTHROPIC_KEY?.trim());
}

function buildAnthropicPayload({ messages = [], maxTokens = 1024, stream = false }) {
  const system = messages.find((m) => m.role === 'system')?.content?.trim() || undefined;
  const chatMessages = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: m.content }));

  return {
    model: ANTHROPIC_MODEL,
    max_tokens: maxTokens,
    stream,
    ...(system ? { system } : {}),
    messages: chatMessages.length ? chatMessages : [{ role: 'user', content: 'Hello' }],
  };
}

async function anthropicFetch(body) {
  const key = import.meta.env.VITE_ANTHROPIC_KEY?.trim();
  if (!key) throw new Error('Anthropic key not configured');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Anthropic request failed');
  }
  return res;
}

export async function callAnthropicDirect(message, { maxTokens = 1024 } = {}) {
  const res = await anthropicFetch(buildAnthropicPayload({
    messages: [{ role: 'user', content: message }],
    maxTokens,
  }));
  const data = await res.json();
  const block = data.content?.find((c) => c.type === 'text');
  return block?.text || '';
}

export async function* streamAnthropicDirect({ messages = [], maxTokens = 1024 }) {
  const res = await anthropicFetch(buildAnthropicPayload({ messages, maxTokens, stream: true }));
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (!payload || payload === '[DONE]') continue;

      let event;
      try {
        event = JSON.parse(payload);
      } catch {
        continue;
      }

      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        yield event.delta.text || '';
      }
    }
  }
}
