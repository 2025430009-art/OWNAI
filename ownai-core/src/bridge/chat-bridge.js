/**
 * CLI / terminal bridge — chatSendCmdRetry / chatRecvMsgWait for ownai-core.
 */

const DEFAULT_API = process.env.OWNAI_API_URL || 'http://localhost:3000';
const DEFAULT_RETRIES = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function consumeSse(response, { onToken } = {}) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';

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
      if (event.type === 'text' && event.token) {
        text += event.token;
        onToken?.(text, event.token);
      }
      if (event.type === 'text_replace' && event.text) {
        text = event.text;
        onToken?.(text, event.text);
      }
    }
  }

  return { text };
}

export class ChatBridge {
  constructor(baseUrl = DEFAULT_API, options = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.sessionId = options.sessionId || null;
    this.apiKey = options.apiKey || process.env.OWNAI_API_KEY || null;
    this.cookie = options.cookie || null;
  }

  headers(extra = {}) {
    const headers = { 'Content-Type': 'application/json', ...extra };
    if (this.sessionId) headers['x-session-id'] = this.sessionId;
    if (this.apiKey) headers['x-api-key'] = this.apiKey;
    if (this.cookie) headers.Cookie = this.cookie;
    return headers;
  }

  async chatSendCmdRetry(command, { retries = DEFAULT_RETRIES } = {}) {
    let lastError;
    for (let attempt = 0; attempt < retries; attempt += 1) {
      try {
        const res = await fetch(`${this.baseUrl}/api/v1/chat-bridge/command`, {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify(command),
        });
        if (res.ok) return res;
        const data = await res.json().catch(() => ({}));
        const err = new Error(data.error || `HTTP ${res.status}`);
        if (res.status < 500 || attempt >= retries - 1) throw err;
        lastError = err;
        await sleep(1000 * (attempt + 1));
      } catch (error) {
        lastError = error;
        if (attempt >= retries - 1) throw error;
        await sleep(1000 * (attempt + 1));
      }
    }
    throw lastError || new Error('chatSendCmdRetry failed');
  }

  async chatSendMessage(prompt, options = {}) {
    return this.chatSendCmdRetry({
      type: 'send_message',
      payload: { prompt, stream: options.stream !== false, ...options },
    });
  }

  async chatRecvMsgWait(response, { onToken } = {}) {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/event-stream')) {
      return consumeSse(response, { onToken });
    }
    const data = await response.json();
    const text = data.output || '';
    onToken?.(text);
    return { text, ...data };
  }

  async chat(prompt, options = {}) {
    const response = await this.chatSendMessage(prompt, options);
    return this.chatRecvMsgWait(response, options);
  }
}

export default ChatBridge;
