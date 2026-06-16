import { Router } from 'express';
import { authMiddleware, optionalAuth } from '../middleware/auth.js';
import { modelManager } from '../services/modelManager.js';
import { getTransformerArchitectureReference } from '../data/transformerArchitecture.js';

const router = Router();

/**
 * @openapi
 * /api/v1/models:
 *   get:
 *     summary: List loaded models in cache
 *     tags: [Models]
 */
router.get('/', optionalAuth, (_req, res) => {
  res.json({
    success: true,
    models: modelManager.getCacheStatus(),
    available: [
      { key: 'default', src: 'LLAMA_3_2_1B_INST_Q4_0', name: 'Llama 3.2 1B Instruct Q4' },
    ],
  });
});

router.get('/transformer-architecture', (_req, res) => {
  res.json({
    success: true,
    ...getTransformerArchitectureReference(),
  });
});

/**
 * @openapi
 * /api/v1/models/{key}:
 *   delete:
 *     summary: Unload a model from cache
 *     tags: [Models]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:key', authMiddleware, async (req, res, next) => {
  try {
    const unloaded = await modelManager.unload(req.params.key);
    if (!unloaded) {
      return res.status(404).json({ error: 'Model not found in cache' });
    }
    res.json({ success: true, message: `Model ${req.params.key} unloaded` });
  } catch (error) {
    next(error);
  }
});

export default router;
