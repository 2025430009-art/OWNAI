import { encodeChatMessage } from './encodeChatMessage.js';

/** Create outbound user message before agent delivery. */
export function createSndMessage(prompt, meta = {}) {
  return encodeChatMessage({
    role: 'user',
    content: prompt,
    meta: { direction: 'outbound', ...meta },
  });
}
