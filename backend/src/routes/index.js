import { Router } from 'express';
import generateRouter from './generate.js';
import authRouter from './auth.js';
import modelsRouter from './models.js';
import capabilitiesRouter from './capabilities.js';
import codeGeneratorsRouter from './codeGenerators.js';
import attachmentsRouter from './attachments.js';
import algorithmsRouter from './algorithms.js';
import mathRouter from './mathRoutes.js';
import aiResearchRouter from './aiResearchRoutes.js';
import ownaiQaRouter from './ownaiQa.js';
import codeLibraryRouter from './codeLibrary.js';
import ragRouter from './rag.js';

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
router.use('/code-generators', codeGeneratorsRouter);
router.use('/attachments', attachmentsRouter);
router.use('/algorithms', algorithmsRouter);
router.use('/math', mathRouter);
router.use('/ai', aiResearchRouter);
router.use('/ownai-qa', ownaiQaRouter);
router.use('/code-library', codeLibraryRouter);
router.use('/rag', ragRouter);

export default router;
