import { Router } from 'express';
import { ENABLE_QVAC } from '../config/index.js';
import { isDatabaseAvailable } from '../db/index.js';
import { isOllamaAvailable } from '../services/ollamaInference.js';
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
import researchRouter from './research.js';
import thinkingRouter from './thinking.js';
import promptToVideoRouter from './promptToVideo.js';

const router = Router();

router.get('/health', async (_req, res) => {
  const ollama = await isOllamaAvailable();
  res.json({
    success: true,
    status: 'ok',
    db: isDatabaseAvailable(),
    ollama,
    qvac: ENABLE_QVAC,
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
router.use('/research', researchRouter);
router.use('/think', thinkingRouter);
router.use('/prompt-to-video', promptToVideoRouter);

export default router;
