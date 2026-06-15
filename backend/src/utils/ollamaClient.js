const OLLAMA_BASE = (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/$/, '');

export async function chatOllama({
  model,
  messages,
  stream = false,
  temperature = 0.7,
}) {
  const response = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream,
      options: { temperature },
    }),
    signal: AbortSignal.timeout(stream ? 120000 : 60000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Ollama error (${response.status}): ${text || 'not responding'}`);
  }

  if (stream) return response;

  const data = await response.json();
  return data.message?.content ?? '';
}

export async function isOllamaReachable() {
  try {
    const response = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(2500),
    });
    return response.ok;
  } catch {
    return false;
  }
}
