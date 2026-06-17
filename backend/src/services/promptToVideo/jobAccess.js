import { resolveDbUserId } from '../thinkingLogService.js';

export function jobOwnerId(job) {
  if (!job) return null;
  const id = job.user_id ?? job.userId;
  return id == null ? null : String(id);
}

export function requestUserId(req) {
  const dbId = resolveDbUserId(req);
  if (dbId != null) return String(dbId);
  if (req.user?.id != null) return String(req.user.id);
  return null;
}

export function canAccessJob(req, job) {
  if (!job) return false;
  const owner = jobOwnerId(job);
  const caller = requestUserId(req);
  return Boolean(caller && owner && caller === owner);
}

export function canAccessJobByShareToken(token, job) {
  if (!job || !token) return false;
  return job.share_token === token;
}
