export const INTELLIGENCE_MODES = {
  FAST: 'FAST MODE',
  THINK: 'THINK MODE',
  DEEP: 'DEEP MODE',
  CREATE: 'CREATE MODE',
};

const DEFAULT_MODEL = 'llama3.1:8b';

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
      return { model: 'qwen2.5:7b', mode: INTELLIGENCE_MODES.DEEP };
    }

    if (
      msg.includes('think')
      || msg.includes('reason')
      || msg.includes('analyze')
      || msg.includes('why')
      || msg.includes('compare')
      || msg.includes('explain')
    ) {
      return { model: 'deepseek-r1:7b', mode: INTELLIGENCE_MODES.THINK };
    }

    if (
      msg.includes('write')
      || msg.includes('email')
      || msg.includes('story')
      || msg.includes('essay')
      || msg.includes('draft')
      || msg.includes('poem')
    ) {
      return { model: 'mistral', mode: INTELLIGENCE_MODES.CREATE };
    }

    return { model: DEFAULT_MODEL, mode: INTELLIGENCE_MODES.FAST };
  },
};

export function detectTask(message) {
  return MODEL_ROUTER.detectTask(message);
}
