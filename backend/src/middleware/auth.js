import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export function signToken(payload) {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwt.secret);
}

function extractToken(req) {
  const cookieToken = req.cookies?.auth_token;
  if (cookieToken) return cookieToken;

  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return header.slice(7);
  }
  return header?.replace('Bearer ', '') || null;
}

export function authMiddleware(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function optionalAuth(req, _res, next) {
  const token = extractToken(req);
  if (token) {
    try {
      req.user = verifyToken(token);
    } catch {
      req.user = null;
    }
  }
  next();
}

function authenticateRequest(req) {
  const token = extractToken(req);
  if (token) {
    return verifyToken(token);
  }

  const apiKey = req.headers['x-api-key'];
  if (config.security.apiKey && apiKey === config.security.apiKey) {
    return { id: 'api-key', email: 'api-key@system', apiKey: true };
  }

  return null;
}

/** Require JWT or API key when security.requireAuth is enabled; otherwise optional in dev only. */
export function inferenceAuth(req, res, next) {
  if (!config.security.requireAuth) {
    if (config.nodeEnv === 'production') {
      return res.status(401).json({ error: 'Authentication required in production' });
    }
    return optionalAuth(req, res, next);
  }

  try {
    const user = authenticateRequest(req);
    if (user) {
      req.user = user;
      return next();
    }
    if (process.env.ALLOW_PUBLIC_INFERENCE === 'true') {
      req.user = { id: 'public', email: 'guest@ownai', public: true };
      return next();
    }
    return res.status(401).json({ error: 'Authentication required' });
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
