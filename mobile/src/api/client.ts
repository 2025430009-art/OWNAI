const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

function getToken(): string | null {
  // In production, use expo-secure-store
  return null;
}

export async function generateOnline(prompt: string, options: {
  max_tokens?: number;
  temperature?: number;
} = {}) {
  const token = getToken();
  const response = await fetch(`${API_BASE}/api/v1/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      prompt,
      max_tokens: options.max_tokens ?? 100,
      temperature: options.temperature ?? 0.7,
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data.output as string;
}

export async function healthCheck() {
  const response = await fetch(`${API_BASE}/api/v1/health`);
  return response.json();
}
