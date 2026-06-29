import { encodeChatMessage } from '../core/encodeChatMessage.js';
import { toView } from '../core/toView.js';
import { pushOutputEvent, markOutputDone } from '../bridge/outputQueue.js';
import { persistChatExchange } from '../storage/chatMessageStore.js';

/** Process agent completion → storage + outputQ (SimpleX agentSubscriber). */
export async function processAgentResult(job, result, onEvent) {
  const assistant = encodeChatMessage({
    role: 'assistant',
    content: result?.text || '',
    meta: {
      direction: 'inbound',
      mode: result?.mode,
      confidence: result?.confidence,
    },
  });

  if (job.chatKey && job.userPrompt) {
    persistChatExchange(job.chatKey, job.userPrompt, assistant.content);
  }

  const viewEvent = toView({
    type: 'done',
    result: {
      text: assistant.content,
      thinking: result?.thinking || '',
      mode: result?.mode,
      confidence: result?.confidence,
      structured: result?.structured,
    },
  });

  if (viewEvent) {
    onEvent?.(viewEvent);
    if (job.correlationId) {
      pushOutputEvent(job.correlationId, viewEvent);
      markOutputDone(job.correlationId);
    }
  }

  return assistant;
}

/** Forward streaming agent events to outputQ after toView mapping. */
export function forwardAgentEvent(correlationId, event) {
  const view = toView(event);
  if (view && correlationId) {
    pushOutputEvent(correlationId, view);
  }
  return view;
}
