import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { createQaSchema } from '../middleware/ownaiQaValidate.js';
import {
  createQaEntry,
  listQaEntries,
  deleteQaEntry,
  searchQaEntries,
  OwnAIQaError,
} from '../services/ownaiQaService.js';

const router = Router();

function handleQa(handler) {
  return async (req, res, next) => {
    try {
      const result = await handler(req);
      res.json({ success: true, ...result });
    } catch (error) {
      if (error instanceof OwnAIQaError) {
        return res.status(error.code === 'NOT_FOUND' ? 404 : error.status).json({
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
 * /api/v1/ownai-qa:
 *   post:
 *     summary: Save a new OWN AI Q&A pair
 *     tags: [OWN AI Reference]
 */
router.post('/', validate(createQaSchema), handleQa(async (req) => {
  const entry = await createQaEntry(req.validated);
  return { entry };
}));

/**
 * @openapi
 * /api/v1/ownai-qa:
 *   get:
 *     summary: List saved Q&A pairs (optional q, topic filters)
 *     tags: [OWN AI Reference]
 */
router.get('/', handleQa(async (req) => {
  const { q, topic } = req.query;
  const entries = await listQaEntries({ q, topic });
  return { entries, count: entries.length };
}));

/**
 * @openapi
 * /api/v1/ownai-qa/search:
 *   get:
 *     summary: Keyword search across questions and answers
 *     tags: [OWN AI Reference]
 */
router.get('/search', handleQa(async (req) => {
  const q = req.query.q || '';
  if (!q.trim()) {
    return { entries: [], count: 0 };
  }
  const entries = await searchQaEntries(q.trim());
  return { entries, count: entries.length, query: q.trim() };
}));

/**
 * @openapi
 * /api/v1/ownai-qa/{id}:
 *   delete:
 *     summary: Delete a saved Q&A pair
 *     tags: [OWN AI Reference]
 */
router.delete('/:id', handleQa(async (req) => {
  const result = await deleteQaEntry(req.params.id);
  return result;
}));

export default router;
