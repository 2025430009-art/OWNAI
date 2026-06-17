import { generateText } from '../api/client.js';
import { titleFromFirstMessage } from './chatStorage.js';

/** Generate a short conversation title from the first user message. */
export async function generateChatTitle(firstMessage) {
  const fallback = titleFromFirstMessage(firstMessage);
  const trimmed = String(firstMessage || '').trim();
  if (!trimmed) return fallback;

  try {
    const res = await generateText({
      prompt: `Give a 4-word title for this conversation: "${trimmed.slice(0, 200)}". Reply with ONLY the title, no punctuation.`,
      stream: false,
      max_tokens: 24,
      use_rag: false,
      enable_thinking: false,
      reasoning_mode: 'direct',
    });
    const raw = (res.output || res.content || '').trim().replace(/[.!?"']/g, '');
    if (raw && raw.length <= 60) return raw;
  } catch {
    // use fallback
  }
  return fallback;
}
