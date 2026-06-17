/** RFC 4122 UUID v4 */
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidSessionId(id) {
  return typeof id === 'string' && UUID_V4_RE.test(id);
}

export function parseSessionId(value) {
  if (value == null) return null;
  const id = String(value).trim();
  return isValidSessionId(id) ? id : null;
}
