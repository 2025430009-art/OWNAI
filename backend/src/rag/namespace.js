import { config } from '../config/index.js';
import { parseSessionId } from '../utils/sessionId.js';

function getSessionId(req) {
  return parseSessionId(
    req.headers['x-session-id']
    || req.body?.sessionId
    || req.body?.session_id
    || req.query?.session_id,
  );
}

/** Resolve the RAG namespace for the current request. */
export function resolveRagNamespace(req) {
  if (req.user?.id && req.user.id !== 'public') {
    return String(req.user.id);
  }

  const sessionId = getSessionId(req);
  if (sessionId) {
    return `session:${sessionId}`;
  }

  if (config.nodeEnv === 'production') {
    return null;
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
  const hasUser = Boolean(req.user?.id && req.user.id !== 'public');
  const sessionId = getSessionId(req);

  if (!hasUser && !sessionId) {
    return res.status(403).json({ error: 'Authentication or valid session ID required to clear RAG store' });
  }

  const callerNamespace = resolveRagNamespace(req);
  const targetNamespace = req.query?.namespace?.toString() || callerNamespace;

  if (targetNamespace !== callerNamespace && !isRagAdmin(req.user)) {
    return res.status(403).json({ error: 'Not authorized to clear this RAG namespace' });
  }

  req.ragNamespace = targetNamespace;
  return next();
}
