import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export function signToken(payload) {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwt.secret);
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const token = header.slice(7);
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      req.user = verifyToken(header.slice(7));
    } catch {
      req.user = null;
    }
  }
  next();
}

function authenticateRequest(req) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return verifyToken(header.slice(7));
  }

  const apiKey = req.headers['x-api-key'];
  if (config.security.apiKey && apiKey === config.security.apiKey) {
    return { id: 'api-key', email: 'api-key@system', apiKey: true };
  }

  return null;
}

/** Require JWT or API key when security.requireAuth is enabled; otherwise optional. */
export function inferenceAuth(req, res, next) {
  if (!config.security.requireAuth) {
    return optionalAuth(req, res, next);
  }

  try {
    const user = authenticateRequest(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Always require JWT or API key. */
export function requireApiAuth(req, res, next) {
  try {
    const user = authenticateRequest(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
