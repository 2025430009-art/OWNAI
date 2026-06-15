import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { validate, signupSchema, loginSchema } from '../middleware/validate.js';
import { authMiddleware, signToken } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import { findUserByEmail, createUser, getUserUsageStats } from '../db/index.js';

const router = Router();

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
    const { email, password } = req.validated;
    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await createUser(email, passwordHash);
    const token = signToken({ id: user.id, email: user.email });

    res.status(201).json({
      success: true,
      token,
      user: { id: user.id, email: user.email },
    });
  } catch (error) {
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
    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email },
    });
  } catch (error) {
    next(error);
  }
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
