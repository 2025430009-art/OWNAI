import { Router } from 'express';
import { CAPABILITIES, getCapability } from '../data/capabilities.js';
import { capabilityService } from '../services/capabilityService.js';
import { inferenceAuth } from '../middleware/auth.js';
import { inferenceRateLimiter } from '../middleware/rateLimiter.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * @openapi
 * /api/v1/capabilities:
 *   get:
 *     summary: List all AI capabilities
 *     tags: [Capabilities]
 */
router.get('/', (_req, res) => {
  res.json({
    success: true,
    count: CAPABILITIES.length,
    capabilities: CAPABILITIES.map(({ id, slug, title, description, backend, modelType, icon, endpoint, demo }) => ({
      id,
      slug,
      title,
      description,
      backend,
      modelType,
      icon,
      endpoint,
      demo,
    })),
  });
});

/**
 * @openapi
 * /api/v1/capabilities/{slug}:
 *   get:
 *     summary: Get capability details
 *     tags: [Capabilities]
 */
router.get('/:slug', (req, res) => {
  const capability = getCapability(req.params.slug);
  if (!capability) {
    return res.status(404).json({ error: 'Capability not found' });
  }
  res.json({ success: true, capability });
});

/**
 * @openapi
 * /api/v1/capabilities/{slug}/execute:
 *   post:
 *     summary: Execute an AI capability
 *     tags: [Capabilities]
 */
router.post('/:slug/execute', inferenceAuth, inferenceRateLimiter, async (req, res, next) => {
  const capability = getCapability(req.params.slug);
  if (!capability) {
    return res.status(404).json({ error: 'Capability not found' });
  }

  const startTime = Date.now();
  try {
    const result = await capabilityService.execute(req.params.slug, req.body);
    res.json({
      success: true,
      capability: capability.slug,
      result,
      meta: { duration_ms: Date.now() - startTime },
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        error: error.message,
        capability: capability.slug,
        hint: error.status === 503
          ? `Configure ${capability.modelType} model in .env — see .env.example`
          : undefined,
      });
    }
    logger.error('Capability execution failed', {
      slug: capability.slug,
      error: error.message,
    });
    next(error);
  }
});

export default router;
