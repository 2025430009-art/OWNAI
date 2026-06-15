import { config } from '../config/index.js';

/**
 * Returns session_id from query, body, or headers.
 */
export function getRequestSessionId(req) {
  return req.query.session_id?.toString()
    || req.body?.session_id?.toString()
    || req.headers['x-session-id']?.toString()
    || null;
}

/**
 * Check whether the request may access an attachment record.
 */
export function canAccessAttachment(attachment, req) {
  if (!attachment) return false;

  if (req.user?.id && attachment.userId === req.user.id) {
    return true;
  }

  const sessionId = getRequestSessionId(req);
  if (sessionId && attachment.sessionId === sessionId) {
    return true;
  }

  return false;
}

export function assertAttachmentAccess(attachment, req) {
  if (!canAccessAttachment(attachment, req)) {
    const error = new Error('Access denied to attachment');
    error.status = 403;
    throw error;
  }
}

export function requireSessionOrAuth(req, res, next) {
  if (req.user?.id || getRequestSessionId(req)) {
    return next();
  }
  return res.status(400).json({
    error: 'session_id query parameter or authentication is required',
  });
}
