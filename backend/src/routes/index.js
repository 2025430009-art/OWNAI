import { Router } from 'express';
import generateRouter from './generate.js';
import authRouter from './auth.js';
import modelsRouter from './models.js';
import capabilitiesRouter from './capabilities.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

router.use('/generate', generateRouter);
router.use('/auth', authRouter);
router.use('/models', modelsRouter);
router.use('/capabilities', capabilitiesRouter);

export default router;
