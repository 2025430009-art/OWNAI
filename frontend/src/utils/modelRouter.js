export const INTELLIGENCE_MODES = {
  FAST: 'FAST MODE',
  THINK: 'THINK MODE',
  DEEP: 'DEEP MODE',
  CREATE: 'CREATE MODE',
};

export const OLLAMA_MODELS = {
  CHAT: 'llama3.2:3b',
  CODE: 'qwen2.5:7b',
  FALLBACK: 'mistral:7b',
};

const DEFAULT_MODEL = OLLAMA_MODELS.CHAT;

export const MODEL_ROUTER = {
  detectTask(message) {
    const msg = String(message || '').toLowerCase();

    if (
      msg.includes('code')
      || msg.includes('bug')
      || msg.includes('function')
      || msg.includes('error')
      || msg.includes('debug')
      || msg.includes('typescript')
      || msg.includes('javascript')
      || msg.includes('python')
    ) {
      return { model: OLLAMA_MODELS.CODE, mode: INTELLIGENCE_MODES.DEEP, task: 'code' };
    }

    if (
      msg.includes('think')
      || msg.includes('reason')
      || msg.includes('analyze')
      || msg.includes('why')
      || msg.includes('compare')
      || msg.includes('explain')
    ) {
      return { model: OLLAMA_MODELS.FALLBACK, mode: INTELLIGENCE_MODES.THINK, task: 'chat' };
    }

    if (
      msg.includes('write')
      || msg.includes('email')
      || msg.includes('story')
      || msg.includes('essay')
      || msg.includes('draft')
      || msg.includes('poem')
    ) {
      return { model: OLLAMA_MODELS.FALLBACK, mode: INTELLIGENCE_MODES.CREATE, task: 'chat' };
    }

    return { model: DEFAULT_MODEL, mode: INTELLIGENCE_MODES.FAST, task: 'chat' };
  },
};

export function detectTask(message) {
  return MODEL_ROUTER.detectTask(message);
}
