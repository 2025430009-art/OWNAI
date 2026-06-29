/** Encode a chat message for agent delivery. */
export function encodeChatMessage({ role, content, meta = {} }) {
  return {
    role,
    content: String(content || ''),
    meta,
    encodedAt: new Date().toISOString(),
  };
}
