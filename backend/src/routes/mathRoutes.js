import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { inferenceAuth } from '../middleware/auth.js';
import { computeRateLimiter } from '../middleware/rateLimiter.js';
import {
  quadraticSchema,
  linearSystemSchema,
  derivativeSchema,
  integralSchema,
  statisticsSchema,
  newtonRaphsonSchema,
} from '../middleware/mathValidate.js';
import {
  solveQuadratic,
  solveLinearSystem2x2,
  computeDerivative,
  integrateSimpson,
  computeStatistics,
  solveNewtonRaphson,
  MathSolverError,
} from '../services/mathSolver.js';

const router = Router();

router.use(inferenceAuth, computeRateLimiter);

function handleMath(handler) {
  return (req, res, next) => {
    try {
      const result = handler(req.validated);
      res.json({ success: true, result });
    } catch (error) {
      if (error instanceof MathSolverError) {
        return res.status(error.status).json({
          error: error.message,
          code: error.code,
        });
      }
      return next(error);
    }
  };
}

/**
 * @openapi
 * /api/v1/math/quadratic:
 *   post:
 *     summary: Solve quadratic equation ax² + bx + c = 0
 *     tags: [Math]
 */
router.post('/quadratic', validate(quadraticSchema), handleMath(({ a, b, c }) => solveQuadratic(a, b, c)));

/**
 * @openapi
 * /api/v1/math/linear-system:
 *   post:
 *     summary: Solve 2×2 linear system via Cramer's Rule
 *     tags: [Math]
 */
router.post(
  '/linear-system',
  validate(linearSystemSchema),
  handleMath(({ a1, b1, c1, a2, b2, c2 }) => solveLinearSystem2x2(a1, b1, c1, a2, b2, c2)),
);

/**
 * @openapi
 * /api/v1/math/derivative:
 *   post:
 *     summary: Symbolic derivative of expression with respect to x
 *     tags: [Math]
 */
router.post(
  '/derivative',
  validate(derivativeSchema),
  handleMath(({ expression }) => computeDerivative(expression)),
);

/**
 * @openapi
 * /api/v1/math/integral:
 *   post:
 *     summary: Definite integral via Simpson's Rule
 *     tags: [Math]
 */
router.post(
  '/integral',
  validate(integralSchema),
  handleMath(({ expression, a, b, n }) => integrateSimpson(expression, a, b, n)),
);

/**
 * @openapi
 * /api/v1/math/statistics:
 *   post:
 *     summary: Descriptive statistics and optional linear regression
 *     tags: [Math]
 */
router.post(
  '/statistics',
  validate(statisticsSchema),
  handleMath(({ data, x, y }) => computeStatistics(data, x ?? null, y ?? null)),
);

/**
 * @openapi
 * /api/v1/math/newton-raphson:
 *   post:
 *     summary: Find roots via Newton-Raphson (secant fallback)
 *     tags: [Math]
 */
router.post(
  '/newton-raphson',
  validate(newtonRaphsonSchema),
  handleMath(({
    function: fn,
    derivative,
    initialGuess,
    secondGuess,
    tolerance,
    maxIterations,
  }) => solveNewtonRaphson(fn, initialGuess, tolerance, maxIterations, {
    derivative,
    secondGuess,
  })),
);

export default router;
