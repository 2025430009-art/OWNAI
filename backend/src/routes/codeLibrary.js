import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { inferenceAuth } from '../middleware/auth.js';
import { createCodeEntrySchema, updateCodeEntrySchema } from '../middleware/codeLibraryValidate.js';
import {
  createCodeEntry,
  listCodeEntries,
  getCodeEntry,
  updateCodeEntry,
  deleteCodeEntry,
  searchCodeEntries,
  filterCodeEntries,
  CodeLibraryError,
} from '../services/codeLibraryService.js';

const router = Router();

function handleLibrary(handler) {
  return async (req, res, next) => {
    try {
      const result = await handler(req);
      res.json({ success: true, ...result });
    } catch (error) {
      if (error instanceof CodeLibraryError) {
        return res.status(error.code === 'NOT_FOUND' ? 404 : error.status).json({
          error: error.message,
          code: error.code,
        });
      }
      return next(error);
    }
  };
}

function parseFilters(query) {
  return {
    q: query.q,
    lang: query.lang,
    type: query.type || query.category,
    sort: query.sort || 'newest',
  };
}

/**
 * @openapi
 * /api/v1/code-library:
 *   post:
 *     summary: Save a new code library entry
 *     tags: [Code Library]
 */
router.post('/', inferenceAuth, validate(createCodeEntrySchema), handleLibrary(async (req) => {
  const entry = await createCodeEntry(req.validated);
  return { entry };
}));

/**
 * @openapi
 * /api/v1/code-library:
 *   get:
 *     summary: List all code library entries
 *     tags: [Code Library]
 */
router.get('/', handleLibrary(async (req) => {
  const filters = parseFilters(req.query);
  const entries = await listCodeEntries(filters);
  return { entries, count: entries.length };
}));

/**
 * @openapi
 * /api/v1/code-library/search:
 *   get:
 *     summary: Search code library by keyword
 *     tags: [Code Library]
 */
router.get('/search', handleLibrary(async (req) => {
  const q = req.query.q || '';
  const entries = q.trim()
    ? await searchCodeEntries(q.trim(), parseFilters(req.query))
    : [];
  return { entries, count: entries.length, query: q.trim() };
}));

/**
 * @openapi
 * /api/v1/code-library/filter:
 *   get:
 *     summary: Filter by language or algorithm type
 *     tags: [Code Library]
 */
router.get('/filter', handleLibrary(async (req) => {
  const entries = await filterCodeEntries(parseFilters(req.query));
  return { entries, count: entries.length };
}));

/**
 * @openapi
 * /api/v1/code-library/{id}:
 *   get:
 *     summary: Get single code library entry
 *     tags: [Code Library]
 */
router.get('/:id', handleLibrary(async (req) => {
  const entry = await getCodeEntry(req.params.id);
  return { entry };
}));

/**
 * @openapi
 * /api/v1/code-library/{id}:
 *   put:
 *     summary: Update code library entry
 *     tags: [Code Library]
 */
router.put('/:id', inferenceAuth, validate(updateCodeEntrySchema), handleLibrary(async (req) => {
  const entry = await updateCodeEntry(req.params.id, req.validated);
  return { entry };
}));

/**
 * @openapi
 * /api/v1/code-library/{id}:
 *   delete:
 *     summary: Delete code library entry
 *     tags: [Code Library]
 */
router.delete('/:id', inferenceAuth, handleLibrary(async (req) => {
  const result = await deleteCodeEntry(req.params.id);
  return result;
}));

export default router;
