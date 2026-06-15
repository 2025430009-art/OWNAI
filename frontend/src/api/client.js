const API_BASE = import.meta.env.VITE_API_URL || '';

function getToken() {
  return localStorage.getItem('ownai_token');
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function generateText({ prompt, max_tokens, temperature, model_key, stream }) {
  const response = await fetch(`${API_BASE}/api/v1/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ prompt, max_tokens, temperature, model_key, stream }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Request failed: ${response.status}`);
  }

  if (stream) {
    return response;
  }

  return response.json();
}

export async function signup(email, password) {
  const response = await fetch(`${API_BASE}/api/v1/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Signup failed');
  return data;
}

export async function login(email, password) {
  const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Login failed');
  return data;
}

export async function getMe() {
  const response = await fetch(`${API_BASE}/api/v1/auth/me`, {
    headers: authHeaders(),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to fetch profile');
  return data;
}

export async function listModels() {
  const response = await fetch(`${API_BASE}/api/v1/models`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to list models');
  return data;
}

export async function healthCheck() {
  const response = await fetch(`${API_BASE}/api/v1/health`);
  return response.json();
}

export async function listCapabilities() {
  const response = await fetch(`${API_BASE}/api/v1/capabilities`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to list capabilities');
  return data;
}

export async function executeCapability(slug, payload) {
  const response = await fetch(`${API_BASE}/api/v1/capabilities/${slug}/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || data.hint || `Capability failed: ${response.status}`);
  }
  return data;
}
