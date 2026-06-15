import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { inferenceAuth } from '../middleware/auth.js';
import {
  assertAttachmentAccess,
  getRequestSessionId,
  requireSessionOrAuth,
} from '../middleware/attachmentAccess.js';
import { inferenceRateLimiter } from '../middleware/rateLimiter.js';
import { config } from '../config/index.js';
import {
  saveAttachment,
  getAttachment,
  listAttachments,
  deleteAttachment,
  buildPromptWithAttachments,
} from '../services/attachmentService.js';
import { modelManager } from '../services/modelManager.js';
import { applyAlgorithm } from '../services/algorithmService.js';
import { logger } from '../utils/logger.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.uploadMaxFileSize,
    files: config.uploadMaxFiles,
  },
});

router.get('/', inferenceAuth, requireSessionOrAuth, async (req, res, next) => {
  try {
    const sessionId = getRequestSessionId(req);
    const items = await listAttachments({
      sessionId,
      userId: req.user?.id ?? null,
    });
    res.json({ success: true, attachments: items });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', inferenceAuth, async (req, res, next) => {
  try {
    const attachment = await getAttachment(req.params.id);
    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }
    assertAttachmentAccess(attachment, req);
    res.json({ success: true, attachment });
  } catch (error) {
    if (error.status === 403) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

router.get('/:id/file', inferenceAuth, async (req, res, next) => {
  try {
    const attachment = await getAttachment(req.params.id);
    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }
    assertAttachmentAccess(attachment, req);

    const filePath = path.resolve(config.uploadPath, attachment.storedName);
    await fs.access(filePath);
    res.setHeader('Content-Type', attachment.mimetype);
    res.setHeader('Content-Disposition', `inline; filename="${attachment.originalName}"`);
    return res.sendFile(filePath);
  } catch (error) {
    if (error.status === 403) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

router.post('/', inferenceAuth, upload.array('files', config.uploadMaxFiles), async (req, res, next) => {
  try {
    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ error: 'No files uploaded. Use field name "files".' });
    }

    const sessionId = getRequestSessionId(req);
    const saved = [];

    for (const file of files) {
      const record = await saveAttachment(file, {
        sessionId,
        userId: req.user?.id ?? null,
      });
      saved.push(record);
    }

    res.status(201).json({ success: true, attachments: saved });
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

router.delete('/:id', inferenceAuth, async (req, res, next) => {
  try {
    const attachment = await getAttachment(req.params.id);
    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }
    assertAttachmentAccess(attachment, req);
    await deleteAttachment(req.params.id);
    res.json({ success: true });
  } catch (error) {
    if (error.status === 403) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

router.post('/chat', inferenceAuth, inferenceRateLimiter, upload.array('files', config.uploadMaxFiles), async (req, res, next) => {
  const startTime = Date.now();

  try {
    const prompt = req.body.prompt?.toString().trim();
    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    const sessionId = getRequestSessionId(req);
    const files = req.files || [];
    const attachmentIds = req.body.attachment_ids
      ? JSON.parse(req.body.attachment_ids)
      : [];

    const uploaded = [];
    for (const file of files) {
      uploaded.push(await saveAttachment(file, {
        sessionId,
        userId: req.user?.id ?? null,
      }));
    }

    const existing = [];
    for (const id of attachmentIds) {
      const item = await getAttachment(id);
      if (!item) continue;
      assertAttachmentAccess(item, req);
      existing.push(item);
    }

    const allAttachments = [...existing, ...uploaded];
    const enrichedPrompt = buildPromptWithAttachments(prompt, allAttachments);
    const stream = req.body.stream === 'true' || req.body.stream === true;
    const max_tokens = parseInt(req.body.max_tokens || '768', 10);
    const temperature = parseFloat(req.body.temperature || '0.7');
    const model_key = req.body.model_key?.toString();
    const algorithm_id = req.body.algorithm_id?.toString() || null;

    const shaped = applyAlgorithm(algorithm_id, enrichedPrompt);
    const finalPrompt = shaped.prompt;
    const finalTemperature = temperature ?? shaped.temperature ?? 0.7;

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.write(`data: ${JSON.stringify({
        meta: {
          attachments: allAttachments.map(({ id, originalName, extension, size }) => ({
            id, originalName, extension, size,
          })),
          ...shaped.meta,
        },
      })}\n\n`);

      const run = await modelManager.generateStream(finalPrompt, {
        max_tokens,
        temperature: finalTemperature,
        modelKey: model_key,
      });

      for await (const token of run.tokenStream) {
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const output = await modelManager.generate(finalPrompt, {
      max_tokens,
      temperature: finalTemperature,
      modelKey: model_key,
    });

    res.json({
      success: true,
      output,
      attachments: allAttachments,
      meta: {
        duration_ms: Date.now() - startTime,
        attachment_count: allAttachments.length,
        ...shaped.meta,
      },
    });
  } catch (error) {
    if (error.status === 403) {
      return res.status(403).json({ error: error.message });
    }
    logger.warn('Attachment chat failed', { error: error.message });
    next(error);
  }
});

router.use((err, req, res, next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large. Max size is 10 MB per file.' });
  }
  if (err?.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({ error: 'Too many files. Max is 5 per upload.' });
  }
  next(err);
});

export default router;
