/**
 * Allow only safe URL schemes in user-generated markdown links.
 */
export function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed, 'https://example.invalid');
    const scheme = parsed.protocol.replace(':', '').toLowerCase();
    if (['http', 'https', 'mailto'].includes(scheme)) {
      return trimmed;
    }
  } catch {
    return null;
  }

  return null;
}
