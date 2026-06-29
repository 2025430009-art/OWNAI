/** Map agent/core events to client view events. */
export function toView(event) {
  if (!event?.type) return null;

  switch (event.type) {
    case 'text':
      return { view: 'token', type: 'text', token: event.token };
    case 'thinking':
      return { view: 'token', type: 'thinking', token: event.token };
    case 'text_replace':
      return { view: 'replace', type: 'text', text: event.text };
    case 'thinking_replace':
      return { view: 'replace', type: 'thinking', text: event.text };
    case 'confidence':
      return { view: 'meta', type: 'confidence', score: event.score, reasoning: event.reasoning };
    case 'meta':
      return { view: 'meta', type: 'meta', ...event };
    case 'done':
      return { view: 'done', type: 'done', result: event.result };
    case 'error':
      return { view: 'error', type: 'error', error: event.error };
    default:
      return { view: 'event', ...event };
  }
}

export function toViewBatch(events) {
  return events.map(toView).filter(Boolean);
}
