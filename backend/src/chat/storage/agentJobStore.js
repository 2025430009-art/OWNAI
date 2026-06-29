import { randomUUID } from 'crypto';

/** In-memory agent delivery jobs (agent DB analogue). */
/** @type {Map<string, object>} */
const jobs = new Map();

export function createAgentJob(payload) {
  const id = randomUUID();
  const job = {
    id,
    status: 'queued',
    createdAt: Date.now(),
    ...payload,
  };
  jobs.set(id, job);
  return job;
}

export function updateAgentJob(id, patch) {
  const job = jobs.get(id);
  if (!job) return null;
  const next = { ...job, ...patch, updatedAt: Date.now() };
  jobs.set(id, next);
  return next;
}

export function getAgentJob(id) {
  return jobs.get(id) || null;
}

export function listAgentJobs(limit = 50) {
  return [...jobs.values()]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}
