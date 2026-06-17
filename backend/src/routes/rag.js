import { Router } from 'express';
import fs from 'fs/promises';
import multer from 'multer';
import path from 'path';
import { inferenceAuth } from '../middleware/auth.js';
import { inferenceRateLimiter } from '../middleware/rateLimiter.js';
import { ingestFile, queryDocuments, ragStatus, clearRagStore } from '../rag/ragChain.js';
import { assertRagClearAccess, resolveRagNamespace } from '../rag/namespace.js';
import { RagQuotaError } from '../rag/vectorStore.js';
import { config } from '../config/index.js';
import { ragUploadFilter } from '../utils/ragUploadAllowlist.js';
import { logger } from '../utils/logger.js';

const router = Router();

const upload = multer({
  dest: config.uploadPath,
  limits: { fileSize: config.uploadMaxFileSize },
  fileFilter: ragUploadFilter,
});

function requireRagNamespace(req, res) {
  const namespace = resolveRagNamespace(req);
  if (!namespace) {
    res.status(400).json({
      error: 'Valid x-session-id header (UUID v4) or authentication required for RAG operations',
    });
    return null;
  }
  return namespace;
}

router.get('/status', inferenceAuth, async (req, res, next) => {
  try {
    const namespace = requireRagNamespace(req, res);
    if (!namespace) return;
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

  const namespace = requireRagNamespace(req, res);
  if (!namespace) {
    await fs.unlink(req.file.path).catch(() => {});
    return;
  }

  try {
    const docCount = (await ragStatus(namespace)).documentCount;
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
    if (/unsupported file type/i.test(error.message)) {
      return res.status(400).json({ error: error.message });
    }
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
    const namespace = requireRagNamespace(req, res);
    if (!namespace) return;
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
    await clearRagStore(req.ragNamespace);
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
