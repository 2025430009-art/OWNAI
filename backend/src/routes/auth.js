import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { validate, signupSchema, loginSchema } from '../middleware/validate.js';
import { authMiddleware, signToken } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import { findUserByEmail, createUser, getUserUsageStats, isDatabaseAvailable } from '../db/index.js';

const router = Router();

const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function setAuthCookie(res, token) {
  res.cookie('auth_token', token, AUTH_COOKIE_OPTIONS);
}

/**
 * @openapi
 * /api/v1/auth/signup:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created
 */
router.post('/signup', authRateLimiter, validate(signupSchema), async (req, res, next) => {
  try {
    if (!isDatabaseAvailable()) {
      return res.status(503).json({
        error: 'Sign-up requires PostgreSQL. Start the database or use chat without an account.',
        code: 'DB_UNAVAILABLE',
      });
    }
    const { email, password } = req.validated;
    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await createUser(email, passwordHash);
    const token = signToken({ id: user.id, email: user.email });
    setAuthCookie(res, token);

    res.status(201).json({
      success: true,
      user: { id: user.id, email: user.email },
    });
  } catch (error) {
    if (error.code === 'DB_UNAVAILABLE') {
      return res.status(503).json({ error: 'Database unavailable. Auth is disabled.', code: 'DB_UNAVAILABLE' });
    }
    next(error);
  }
});

/**
 * @openapi
 * /api/v1/auth/login:
 *   post:
 *     summary: Login
 *     tags: [Auth]
 */
router.post('/login', authRateLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    if (!isDatabaseAvailable()) {
      return res.status(503).json({
        error: 'Sign-in requires PostgreSQL. Chat and AI work without an account.',
        code: 'DB_UNAVAILABLE',
      });
    }
    const { email, password } = req.validated;
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken({ id: user.id, email: user.email });
    setAuthCookie(res, token);
    res.json({
      success: true,
      user: { id: user.id, email: user.email },
    });
  } catch (error) {
    if (error.code === 'DB_UNAVAILABLE') {
      return res.status(503).json({ error: 'Database unavailable. Auth is disabled.', code: 'DB_UNAVAILABLE' });
    }
    next(error);
  }
});

/**
 * @openapi
 * /api/v1/auth/logout:
 *   post:
 *     summary: Clear auth session cookie
 *     tags: [Auth]
 */
router.post('/logout', (_req, res) => {
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
  res.json({ success: true });
});

/**
 * @openapi
 * /api/v1/auth/me:
 *   get:
 *     summary: Get current user profile and usage
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 */
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const usage = await getUserUsageStats(req.user.id);
    res.json({
      success: true,
      user: { id: req.user.id, email: req.user.email },
      usage,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
