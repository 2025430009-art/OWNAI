/**
 * Last-resort local fallback when backend and cloud AI are both unavailable.
 * Never exposes developer instructions to end users.
 */
import { USER_UNAVAILABLE_MSG } from './apiConfig.js';

const TEMPLATES = {
  greeting: () => "Hello! I'm OWNAI. How can I help you today?",
  unavailable: () => USER_UNAVAILABLE_MSG,
};

function classifyPrompt(prompt) {
  const p = prompt.trim().toLowerCase();
  if (/^(hi|hello|hey|good\s+(morning|afternoon|evening)|greetings)\b/.test(p)) return 'greeting';
  return 'unavailable';
}

export function generatePromptResponse(prompt) {
  const kind = classifyPrompt(prompt);
  const fn = TEMPLATES[kind] || TEMPLATES.unavailable;
  return fn(prompt);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function* streamPromptResponse(prompt) {
  const text = generatePromptResponse(prompt);
  const chunks = text.match(/\S+\s*|\n/g) || [text];
  for (const chunk of chunks) {
    yield chunk;
    await sleep(12 + Math.random() * 20);
  }
}

export async function collectPromptResponse(prompt) {
  let out = '';
  for await (const token of streamPromptResponse(prompt)) {
    out += token;
  }
  return out;
}
