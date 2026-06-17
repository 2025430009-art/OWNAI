/**
 * Shared fallback when backend inference is unavailable.
 */
import { streamPromptResponse } from './promptEngine.js';
import { USER_UNAVAILABLE_MSG } from './apiConfig.js';

/** Friendly last-resort message — never dev instructions or client-side API keys. */
export async function* streamFallbackChat({ prompt, chatMessages = [], maxTokens = 1024 }) {
  void chatMessages;
  void maxTokens;
  yield* streamPromptResponse(prompt || USER_UNAVAILABLE_MSG);
}
