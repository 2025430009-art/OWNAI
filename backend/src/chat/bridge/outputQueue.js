/** Per-correlation output queue (SimpleX-style outputQ). */

/** @type {Map<string, { events: object[], waiters: Array<(e: object) => void>, done: boolean }>} */
const channels = new Map();

export function createOutputChannel(correlationId) {
  const channel = { events: [], waiters: [], done: false };
  channels.set(correlationId, channel);
  return channel;
}

export function getOutputChannel(correlationId) {
  return channels.get(correlationId) || null;
}

export function pushOutputEvent(correlationId, event) {
  const channel = channels.get(correlationId);
  if (!channel) return;
  channel.events.push(event);
  const waiters = channel.waiters.splice(0);
  for (const notify of waiters) notify(event);
}

export function markOutputDone(correlationId) {
  const channel = channels.get(correlationId);
  if (channel) channel.done = true;
}

export function subscribeOutput(correlationId, onEvent) {
  const channel = channels.get(correlationId);
  if (!channel) return () => {};
  for (const event of channel.events) onEvent(event);
  if (channel.done) return () => {};
  channel.waiters.push(onEvent);
  return () => {
    const idx = channel.waiters.indexOf(onEvent);
    if (idx >= 0) channel.waiters.splice(idx, 1);
  };
}

export function drainOutputChannel(correlationId) {
  channels.delete(correlationId);
}
