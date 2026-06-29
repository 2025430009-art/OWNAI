import { runThinkingGeneration } from '../../services/thinkingGenerationService.js';
import { createAgentJob, updateAgentJob } from '../storage/agentJobStore.js';
import { processAgentResult } from '../agent/agentSubscriber.js';

/** Deliver outbound messages to the inference agent (SimpleX deliverMessages). */
export async function deliverMessages(job, { onEvent } = {}) {
  updateAgentJob(job.id, { status: 'delivering' });

  const wrappedOnEvent = (event) => {
    onEvent?.(event);
  };

  try {
    const result = await runThinkingGeneration({
      ...job.generationParams,
      onEvent: wrappedOnEvent,
    });

    updateAgentJob(job.id, { status: 'completed', result });
    await processAgentResult(job, result, wrappedOnEvent);
    return result;
  } catch (error) {
    updateAgentJob(job.id, { status: 'failed', error: error.message });
    wrappedOnEvent({ type: 'error', error: error.message });
    throw error;
  }
}

export function enqueueDelivery(payload) {
  return createAgentJob({
    status: 'queued',
    ...payload,
  });
}
