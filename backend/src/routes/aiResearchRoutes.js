import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import {
  optimizeSchema,
  classifySchema,
  clusterSchema,
  predictSchema,
  reduceDimensionsSchema,
  searchSchema,
  nlpSchema,
  graphSchema,
  reinforceSchema,
  statisticsSchema,
  signalSchema,
  combinatorialSchema,
  autoSuggestSchema,
} from '../middleware/aiResearchValidate.js';
import {
  optimize,
  classify,
  cluster,
  predict,
  reduceDimensions,
  search,
  nlp,
  graph,
  reinforcementLearning,
  inferStatistics,
  processSignal,
  solveCombinatorial,
  autoSuggestAlgorithm,
  listAlgorithms,
  ResearchSolverError,
} from '../services/aiResearchSolver.js';

const router = Router();

function handleResearch(handler) {
  return (req, res, next) => {
    try {
      const result = handler(req.validated);
      res.json({ success: true, result });
    } catch (error) {
      if (error instanceof ResearchSolverError) {
        return res.status(error.status).json({ error: error.message, code: error.code });
      }
      return next(error);
    }
  };
}

/**
 * @openapi
 * /api/v1/ai/optimize:
 *   post:
 *     summary: Run optimization algorithms (GA, PSO, SA, GD, ACO)
 *     tags: [AI Research]
 */
router.post('/optimize', validate(optimizeSchema), handleResearch((p) => optimize(p)));

/**
 * @openapi
 * /api/v1/ai/classify:
 *   post:
 *     summary: Classification with model selection
 *     tags: [AI Research]
 */
router.post('/classify', validate(classifySchema), handleResearch((p) => classify(p)));

/**
 * @openapi
 * /api/v1/ai/cluster:
 *   post:
 *     summary: Clustering algorithm picker
 *     tags: [AI Research]
 */
router.post('/cluster', validate(clusterSchema), handleResearch((p) => cluster(p)));

/**
 * @openapi
 * /api/v1/ai/predict:
 *   post:
 *     summary: Time series and regression forecasting
 *     tags: [AI Research]
 */
router.post('/predict', validate(predictSchema), handleResearch((p) => predict(p)));

/**
 * @openapi
 * /api/v1/ai/reduce-dimensions:
 *   post:
 *     summary: Dimensionality reduction (PCA, t-SNE, UMAP, LDA, autoencoder)
 *     tags: [AI Research]
 */
router.post('/reduce-dimensions', validate(reduceDimensionsSchema), handleResearch((p) => reduceDimensions(p)));

/**
 * @openapi
 * /api/v1/ai/search:
 *   post:
 *     summary: Pathfinding and CSP solving
 *     tags: [AI Research]
 */
router.post('/search', validate(searchSchema), handleResearch((p) => search(p)));

/**
 * @openapi
 * /api/v1/ai/nlp:
 *   post:
 *     summary: NLP text processing pipeline
 *     tags: [AI Research]
 */
router.post('/nlp', validate(nlpSchema), handleResearch((p) => nlp(p)));

/**
 * @openapi
 * /api/v1/ai/graph:
 *   post:
 *     summary: Network and graph analysis
 *     tags: [AI Research]
 */
router.post('/graph', validate(graphSchema), handleResearch((p) => graph(p)));

/**
 * @openapi
 * /api/v1/ai/reinforce:
 *   post:
 *     summary: Reinforcement learning training and inference
 *     tags: [AI Research]
 */
router.post('/reinforce', validate(reinforceSchema), handleResearch((p) => reinforcementLearning(p)));

/**
 * @openapi
 * /api/v1/ai/statistics:
 *   post:
 *     summary: Statistical tests and inference
 *     tags: [AI Research]
 */
router.post('/statistics', validate(statisticsSchema), handleResearch((p) => inferStatistics(p)));

/**
 * @openapi
 * /api/v1/ai/signal:
 *   post:
 *     summary: Signal and image processing
 *     tags: [AI Research]
 */
router.post('/signal', validate(signalSchema), handleResearch((p) => processSignal(p)));

/**
 * @openapi
 * /api/v1/ai/combinatorial:
 *   post:
 *     summary: Discrete and combinatorial optimization
 *     tags: [AI Research]
 */
router.post('/combinatorial', validate(combinatorialSchema), handleResearch((p) => solveCombinatorial(p)));

/**
 * @openapi
 * /api/v1/ai/auto-suggest:
 *   post:
 *     summary: Recommend best algorithm for a problem type
 *     tags: [AI Research]
 */
router.post('/auto-suggest', validate(autoSuggestSchema), handleResearch((p) => autoSuggestAlgorithm(p)));

/**
 * @openapi
 * /api/v1/ai/algorithms:
 *   get:
 *     summary: List all available research algorithms by category
 *     tags: [AI Research]
 */
router.get('/algorithms', (_req, res) => {
  res.json({ success: true, result: listAlgorithms() });
});

export default router;
