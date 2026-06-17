import { config } from '../config/index.js';

function getSessionId(req) {
  return req.headers['x-session-id']?.toString()
    || req.body?.sessionId?.toString()
    || req.body?.session_id?.toString()
    || req.query?.session_id?.toString()
    || null;
}

/** Resolve the RAG namespace for the current request. */
export function resolveRagNamespace(req) {
  if (req.user?.id) {
    return String(req.user.id);
  }

  const sessionId = getSessionId(req);
  if (sessionId) {
    return `session:${sessionId}`;
  }

  return 'global';
}

export function isRagAdmin(user) {
  if (!user?.id) return false;
  if (user.isAdmin) return true;
  return config.rag.adminUserIds.has(String(user.id));
}

/** Require identity for clear; restrict cross-namespace clears to admins. */
export function assertRagClearAccess(req, res, next) {
  const hasUser = Boolean(req.user?.id);
  const sessionId = getSessionId(req);

  if (!hasUser && !sessionId) {
    return res.status(403).json({ error: 'Authentication or session ID required to clear RAG store' });
  }

  const callerNamespace = resolveRagNamespace(req);
  const targetNamespace = req.query?.namespace?.toString() || callerNamespace;

  if (targetNamespace !== callerNamespace && !isRagAdmin(req.user)) {
    return res.status(403).json({ error: 'Not authorized to clear this RAG namespace' });
  }

  req.ragNamespace = targetNamespace;
  return next();
}
