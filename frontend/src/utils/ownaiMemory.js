const STORAGE_KEY = 'ownai_memory_v2';
const MAX_SHORT_TERM = 40;

class OwnAIMemory {
  constructor() {
    this.shortTerm = [];
    this.longTerm = {};
    this.sessions = [];
    this.load();
  }

  remember(role, content) {
    if (!content?.trim()) return;

    if (role === 'user') {
      this.extractFacts(content);
    }

    this.shortTerm.push({ role, content: content.trim(), time: Date.now() });
    if (this.shortTerm.length > MAX_SHORT_TERM) {
      this.shortTerm = this.shortTerm.slice(-MAX_SHORT_TERM);
    }
    this.save();
  }

  extractFacts(content) {
    const lower = content.toLowerCase();

    const nameMatch = lower.match(/my name is\s+(.+)/i);
    if (nameMatch) this.longTerm.name = nameMatch[1].split(/[.!?,]/)[0].trim();

    const roleMatch = lower.match(/i am a[n]?\s+(.+)/i);
    if (roleMatch) this.longTerm.role = roleMatch[1].split(/[.!?,]/)[0].trim();

    const projectMatch = lower.match(/i work on\s+(.+)/i);
    if (projectMatch) this.longTerm.project = projectMatch[1].split(/[.!?,]/)[0].trim();
  }

  buildContext() {
    const lines = [];
    if (this.longTerm.name) lines.push(`User's name: ${this.longTerm.name}`);
    if (this.longTerm.role) lines.push(`User is a: ${this.longTerm.role}`);
    if (this.longTerm.project) lines.push(`Working on: ${this.longTerm.project}`);
    return lines.length ? `${lines.join('\n')}\n\n` : '';
  }

  getFacts() {
    return { ...this.longTerm };
  }

  getHistory(last = 10) {
    return this.shortTerm
      .slice(-last)
      .map(({ role, content }) => ({ role, content }));
  }

  saveSession(id, title, messages) {
    const existing = this.sessions.findIndex((s) => s.id === id);
    const entry = { id, title, messages, updatedAt: Date.now() };
    if (existing >= 0) this.sessions[existing] = entry;
    else this.sessions.push(entry);
    if (this.sessions.length > 20) this.sessions = this.sessions.slice(-20);
    this.save();
  }

  save() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          shortTerm: this.shortTerm,
          longTerm: this.longTerm,
          sessions: this.sessions,
        }),
      );
    } catch {
      // storage full or unavailable
    }
  }

  load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const data = JSON.parse(saved);
      this.shortTerm = data.shortTerm || [];
      this.longTerm = data.longTerm || {};
      this.sessions = data.sessions || [];
    } catch {
      this.shortTerm = [];
      this.longTerm = {};
      this.sessions = [];
    }
  }

  clear() {
    this.shortTerm = [];
    this.longTerm = {};
    this.sessions = [];
    localStorage.removeItem(STORAGE_KEY);
  }

  clearLongTerm() {
    this.longTerm = {};
    this.save();
  }
}

const memory = new OwnAIMemory();
export default memory;
