import { Router } from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import { inferenceAuth } from '../middleware/auth.js';
import { inferenceRateLimiter } from '../middleware/rateLimiter.js';
import { ingestDocument, listDocuments } from '../rag/ragEngine.js';
import { resolveRagNamespace } from '../rag/namespace.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const router = Router();

const upload = multer({
  dest: config.uploadPath,
  limits: { fileSize: config.uploadMaxFileSize },
});

router.post('/upload', inferenceAuth, inferenceRateLimiter, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'file is required' });
  }

  const namespace = resolveRagNamespace(req);

  try {
    await fs.mkdir(config.uploadPath, { recursive: true });
    const result = await ingestDocument(
      req.file.path,
      req.file.originalname,
      namespace,
    );
    await fs.unlink(req.file.path).catch(() => {});
    res.json({ success: true, ...result, namespace });
  } catch (err) {
    await fs.unlink(req.file.path).catch(() => {});
    logger.warn('[Documents] upload failed', { error: err.message });
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/', inferenceAuth, async (req, res) => {
  try {
    const namespace = resolveRagNamespace(req);
    const documents = await listDocuments(namespace);
    res.json({ success: true, documents, namespace });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
