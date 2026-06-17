/**
 * Shared fallback when backend inference is unavailable.
 */
import { hasAnthropicDirect, streamAnthropicDirect } from './anthropicDirect.js';
import { streamPromptResponse } from './promptEngine.js';
import { USER_UNAVAILABLE_MSG } from './apiConfig.js';

/** Try Anthropic direct, then friendly last-resort message — never dev instructions. */
export async function* streamFallbackChat({ prompt, chatMessages = [], maxTokens = 1024 }) {
  if (hasAnthropicDirect()) {
    try {
      const messages = chatMessages.length
        ? chatMessages
        : [{ role: 'user', content: prompt }];
      yield* streamAnthropicDirect({ messages, maxTokens });
      return;
    } catch {
      // fall through to friendly message
    }
  }

  yield* streamPromptResponse(prompt || USER_UNAVAILABLE_MSG);
}
