const DEFAULT_API = process.env.OWNAI_API_URL || 'http://localhost:3000';

export class CapabilityBridge {
  constructor(baseUrl = DEFAULT_API) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async health() {
    const res = await fetch(`${this.baseUrl}/api/v1/health`);
    return res.json();
  }

  async listCapabilities() {
    const res = await fetch(`${this.baseUrl}/api/v1/capabilities`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to list capabilities');
    return data.capabilities;
  }

  async execute(slug, payload) {
    const res = await fetch(`${this.baseUrl}/api/v1/capabilities/${slug}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.hint || `Capability ${slug} failed`);
    return data;
  }

  async generate(prompt, options = {}) {
    const res = await fetch(`${this.baseUrl}/api/v1/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, ...options }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Generate failed');
    return data;
  }

  async listModels() {
    const res = await fetch(`${this.baseUrl}/api/v1/models`);
    return res.json();
  }

  async unloadModel(key) {
    const res = await fetch(`${this.baseUrl}/api/v1/models/${key}`, { method: 'DELETE' });
    return res.json();
  }
}
