import { Router } from 'express';
import fs from 'fs/promises';
import multer from 'multer';
import path from 'path';
import { inferenceAuth } from '../middleware/auth.js';
import { inferenceRateLimiter } from '../middleware/rateLimiter.js';
import { ingestFile, queryDocuments, ragStatus } from '../rag/ragChain.js';
import { assertRagClearAccess, resolveRagNamespace } from '../rag/namespace.js';
import { RagQuotaError, vectorStore } from '../rag/vectorStore.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const router = Router();

const upload = multer({
  dest: config.uploadPath,
  limits: { fileSize: config.uploadMaxFileSize },
});

router.get('/status', inferenceAuth, async (req, res, next) => {
  try {
    const namespace = resolveRagNamespace(req);
    const status = await ragStatus(namespace);
    res.json({ success: true, ...status });
  } catch (error) {
    next(error);
  }
});

router.post('/ingest', inferenceAuth, inferenceRateLimiter, upload.single('file'), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'file is required' });
  }

  const namespace = resolveRagNamespace(req);

  try {
    const docCount = await vectorStore.countDocuments(namespace);
    if (docCount >= config.rag.maxDocsPerUser) {
      return res.status(429).json({ error: 'RAG quota exceeded' });
    }

    await fs.mkdir(config.uploadPath, { recursive: true });
    const chunks = await ingestFile(req.file.path, req.file.originalname, namespace);
    await fs.unlink(req.file.path).catch(() => {});
    res.json({
      success: true,
      filename: req.file.originalname,
      chunks,
      namespace,
    });
  } catch (error) {
    await fs.unlink(req.file.path).catch(() => {});
    logger.warn('RAG ingest failed', { error: error.message, namespace });
    if (error instanceof RagQuotaError) {
      return res.status(429).json({ error: 'RAG quota exceeded' });
    }
    if (/embed|transformers|model/i.test(error.message)) {
      return res.status(503).json({
        error: 'RAG embedding model is loading or unavailable. Try again in a moment.',
        details: error.message,
      });
    }
    next(error);
  }
});

router.post('/query', inferenceAuth, inferenceRateLimiter, async (req, res, next) => {
  const { question, top_k: topK = 3 } = req.body || {};
  if (!question?.trim()) {
    return res.status(400).json({ error: 'question is required' });
  }

  try {
    const namespace = resolveRagNamespace(req);
    const context = await queryDocuments(question.trim(), topK, namespace);
    res.json({
      success: true,
      context: context || '',
      hasResults: Boolean(context),
      namespace,
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/clear', inferenceAuth, assertRagClearAccess, async (req, res, next) => {
  try {
    await vectorStore.clear(req.ragNamespace);
    res.json({
      success: true,
      message: 'RAG store cleared',
      namespace: req.ragNamespace,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
