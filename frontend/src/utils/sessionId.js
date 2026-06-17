const STORAGE_KEY = 'ownai_session';

/** Stable RAG/chat session id shared across uploads and inference requests. */
export function getOwnaiSessionId() {
  if (typeof window === 'undefined') return 'default';
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

export function setOwnaiSessionId(id) {
  if (typeof window === 'undefined' || !id) return;
  localStorage.setItem(STORAGE_KEY, id);
}
