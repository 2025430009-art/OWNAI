import { Router } from 'express';
import { inferenceAuth } from '../middleware/auth.js';
import { inferenceRateLimiter } from '../middleware/rateLimiter.js';
import { logUsage } from '../db/index.js';
import { logger } from '../utils/logger.js';
import { streamThinkingToResponse } from '../services/thinkingGenerationService.js';
import {
  ResearchError,
  createProject,
  listProjects,
  getProjectDetail,
  updateProject,
  deleteProject,
  createPaper,
  listPapers,
  deletePaper,
  createGapEntry,
  getGapMatrix,
  createDerivation,
  validateDerivation,
  listDerivations,
  createSimulation,
  updateSimulationResults,
  listSimulations,
  initPhases,
  completePhase,
  listPhases,
  getProjectForGenerate,
} from '../services/researchService.js';
import { buildLiteratureSearchPrompt, LiteratureEngineError } from '../research/literatureEngine.js';
import { buildMathDerivationPrompt, MathEngineError } from '../research/mathEngine.js';
import {
  buildFullCodePrompt,
  buildParserPrompt,
  buildProjectContext,
  getTemplate,
  listTemplates,
  getPipelineOrder,
  CodeEngineError,
} from '../research/codeEngine.js';
import { ingestPaperToRAG, buildAugmentedPrompt } from '../research/ragIntegration.js';
import {
  buildCrossValidationReport,
  analyzeParetoSweep,
  SimulationEngineError,
} from '../research/simulationEngine.js';

const router = Router();

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(value) {
  return typeof value === 'string' && UUID_V4_REGEX.test(value);
}

function parseJsonField(value, fieldName) {
  if (value == null) return undefined;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    const err = new ResearchError(`Invalid ${fieldName} format`);
    err.status = 400;
    throw err;
  }
}

function requireUuid(paramName) {
  return (req, res, next) => {
    const value = req.params[paramName];
    if (!isValidUuid(value)) {
      return res.status(400).json({ error: `Invalid ${paramName}` });
    }
    return next();
  };
}

function handleResearch(handler) {
  return async (req, res, next) => {
    try {
      const result = await handler(req, res);
      if (!res.headersSent) {
        res.json({ success: true, ...result });
      }
    } catch (error) {
      if (error instanceof ResearchError) {
        return res.status(error.status).json({ error: error.message, code: error.code });
      }
      if (
        error instanceof LiteratureEngineError
        || error instanceof MathEngineError
        || error instanceof CodeEngineError
        || error instanceof SimulationEngineError
      ) {
        return res.status(400).json({ error: error.message });
      }
      return next(error);
    }
  };
}

async function streamGenerate(req, res, prompt, endpoint, options = {}) {
  const startTime = Date.now();
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  await streamThinkingToResponse(res, {
    prompt,
    history: [],
    maxTokens: options.max_tokens ?? 4096,
    temperature: options.temperature ?? 0.4,
    reasoningMode: options.reasoning_mode ?? 'extended',
  });

  await logUsage({
    userId: req.user?.id ?? null,
    endpoint,
    promptTokens: prompt.length,
    completionTokens: 0,
    modelKey: 'default',
    durationMs: Date.now() - startTime,
  }).catch((err) => logger.warn('Usage log failed', { error: err.message }));
}

async function loadGenerateContext(projectId, req, project, extraParams = {}) {
  const [derivations, simulations] = await Promise.all([
    listDerivations(projectId, req),
    listSimulations(projectId, req),
  ]);
  return buildProjectContext(project, {
    parameters: extraParams,
    derivations: derivations.map((d) => ({
      name: d.name,
      theorem_statement: d.theorem_statement,
      formula_latex: d.formula_latex,
      validated: d.validated,
    })),
    simulationResults: simulations
      .filter((s) => s.status === 'done' && s.results)
      .map((s) => ({ tool: s.tool, results: s.results })),
  });
}

function normalizeSuccessCriteria(project) {
  const raw = project?.success_criteria;
  if (raw == null) return {};
  if (typeof raw === 'object') return { ...raw };
  return parseJsonField(raw, 'success_criteria') ?? {};
}

// --- Projects ---

router.post('/projects', inferenceAuth, handleResearch(async (req) => {
  const { title, research_question, target_journal, domain, success_criteria } = req.body || {};
  if (!title?.trim()) {
    throw new ResearchError('title is required');
  }
  const project = await createProject(req, {
    title: title.trim(),
    research_question,
    target_journal,
    domain,
    success_criteria: parseJsonField(success_criteria, 'success_criteria'),
  });
  return { project };
}));

router.get('/projects', inferenceAuth, handleResearch(async (req) => {
  const projects = await listProjects(req);
  return { projects };
}));

router.get('/projects/:id', inferenceAuth, requireUuid('id'), handleResearch(async (req) => {
  const detail = await getProjectDetail(req.params.id, req);
  return detail;
}));

router.put('/projects/:id', inferenceAuth, requireUuid('id'), handleResearch(async (req) => {
  const body = req.body || {};
  const project = await updateProject(req.params.id, req, {
    title: body.title,
    research_question: body.research_question,
    target_journal: body.target_journal,
    domain: body.domain,
    phase: body.phase,
    status: body.status,
    success_criteria: parseJsonField(body.success_criteria, 'success_criteria'),
  });
  return { project };
}));

router.delete('/projects/:id', inferenceAuth, requireUuid('id'), handleResearch(async (req) => {
  return deleteProject(req.params.id, req);
}));

// --- Literature ---

router.post('/projects/:id/papers', inferenceAuth, requireUuid('id'), handleResearch(async (req) => {
  const body = req.body || {};
  if (!body.title?.trim()) {
    throw new ResearchError('title is required');
  }
  if (body.paper_id && !isValidUuid(body.paper_id)) {
    throw new ResearchError('Invalid paper_id');
  }
  const paper = await createPaper(req.params.id, req, {
    title: body.title.trim(),
    authors: body.authors,
    journal: body.journal,
    year: body.year,
    doi: body.doi,
    key_contribution: body.key_contribution,
    limitation_gap: body.limitation_gap,
    category: body.category,
    metrics: parseJsonField(body.metrics, 'metrics'),
  });

  const uid = req.user?.id;
  if (uid && uid !== 'api-key') {
    ingestPaperToRAG(paper, uid, req.params.id).catch((err) => {
      logger.warn('Background research paper RAG ingest failed', {
        paperId: paper.id,
        projectId: req.params.id,
        error: err.message,
      });
    });
  }

  return { paper };
}));

router.get('/projects/:id/papers', inferenceAuth, requireUuid('id'), handleResearch(async (req) => {
  const papers = await listPapers(req.params.id, req, {
    category: req.query.category?.toString(),
    sort: req.query.sort?.toString(),
  });
  return { papers };
}));

router.delete('/papers/:paperId', inferenceAuth, requireUuid('paperId'), handleResearch(async (req) => {
  return deletePaper(req.params.paperId, req);
}));

router.post('/projects/:id/gap-matrix', inferenceAuth, requireUuid('id'), handleResearch(async (req) => {
  const body = req.body || {};
  if (!isValidUuid(body.paper_id)) {
    throw new ResearchError('Invalid paper_id');
  }
  if (!body.dimension?.trim()) {
    throw new ResearchError('dimension is required');
  }
  const entry = await createGapEntry(req.params.id, req, body);
  return { entry };
}));

router.get('/projects/:id/gap-matrix', inferenceAuth, requireUuid('id'), handleResearch(async (req) => {
  return getGapMatrix(req.params.id, req);
}));

// --- Math derivations ---

router.post('/projects/:id/derivations', inferenceAuth, requireUuid('id'), handleResearch(async (req) => {
  const body = req.body || {};
  if (!body.name?.trim()) {
    throw new ResearchError('name is required');
  }
  const derivation = await createDerivation(req.params.id, req, {
    name: body.name.trim(),
    theorem_statement: body.theorem_statement,
    proof_steps: parseJsonField(body.proof_steps, 'proof_steps'),
    formula_latex: body.formula_latex,
  });
  return { derivation };
}));

router.put('/derivations/:id/validate', inferenceAuth, requireUuid('id'), handleResearch(async (req) => {
  const pct = req.body?.validation_error_percent;
  if (typeof pct !== 'number' || Number.isNaN(pct)) {
    throw new ResearchError('validation_error_percent must be a number');
  }
  const derivation = await validateDerivation(req.params.id, req, pct);
  return { derivation };
}));

router.get('/projects/:id/derivations', inferenceAuth, requireUuid('id'), handleResearch(async (req) => {
  const derivations = await listDerivations(req.params.id, req);
  return { derivations };
}));

// --- Simulation runs ---

router.post('/projects/:id/simulations', inferenceAuth, requireUuid('id'), handleResearch(async (req) => {
  const body = req.body || {};
  if (!body.tool?.trim()) {
    throw new ResearchError('tool is required');
  }
  const run = await createSimulation(req.params.id, req, {
    tool: body.tool.trim(),
    parameters: parseJsonField(body.parameters, 'parameters'),
  });
  return { run };
}));

router.put('/simulations/:id/results', inferenceAuth, requireUuid('id'), handleResearch(async (req) => {
  const body = req.body || {};
  const run = await updateSimulationResults(req.params.id, req, {
    results: parseJsonField(body.results, 'results'),
    status: body.status ?? 'done',
  });
  return { run };
}));

router.get('/projects/:id/simulations', inferenceAuth, requireUuid('id'), handleResearch(async (req) => {
  const runs = await listSimulations(req.params.id, req, {
    tool: req.query.tool?.toString(),
    status: req.query.status?.toString(),
  });
  return { runs };
}));

router.post('/projects/:id/simulations/validate-cross', inferenceAuth, requireUuid('id'), handleResearch(async (req) => {
  await getProjectForGenerate(req.params.id, req);
  const body = req.body || {};
  const matlabResults = parseJsonField(body.matlab_results, 'matlab_results');
  const pythonResults = parseJsonField(body.python_results, 'python_results');
  const verilogResults = parseJsonField(body.verilog_results, 'verilog_results');

  if (!matlabResults || !pythonResults || !verilogResults) {
    throw new ResearchError('matlab_results, python_results, and verilog_results are required');
  }

  const report = buildCrossValidationReport(matlabResults, pythonResults, verilogResults);
  return { report };
}));

router.post('/projects/:id/simulations/pareto', inferenceAuth, requireUuid('id'), handleResearch(async (req) => {
  const project = await getProjectForGenerate(req.params.id, req);
  const body = req.body || {};
  const sweepResults = parseJsonField(body.sweep_results, 'sweep_results');

  if (!Array.isArray(sweepResults) || !sweepResults.length) {
    throw new ResearchError('sweep_results must be a non-empty array');
  }

  for (const row of sweepResults) {
    if (typeof row.bd_rate !== 'number' || typeof row.adp_savings !== 'number') {
      throw new ResearchError('Each sweep result requires numeric bd_rate and adp_savings');
    }
  }

  const analysis = analyzeParetoSweep(sweepResults);
  const successCriteria = normalizeSuccessCriteria(project);

  if (analysis.optimal_point) {
    successCriteria.pareto_optimal = analysis.optimal_point;
    successCriteria.pareto_front = analysis.pareto_front;
    successCriteria.theoretical_optimal = analysis.theoretical_optimal;
    successCriteria.pareto_updated_at = new Date().toISOString();

    await updateProject(req.params.id, req, { success_criteria: successCriteria });
  }

  return analysis;
}));

// --- Phase tracking ---

router.post('/projects/:id/phases/init', inferenceAuth, requireUuid('id'), handleResearch(async (req) => {
  const phases = await initPhases(req.params.id, req);
  return { phases };
}));

router.put('/phases/:id/complete', inferenceAuth, requireUuid('id'), handleResearch(async (req) => {
  const body = req.body || {};
  const phase = await completePhase(req.params.id, req, {
    outputs: parseJsonField(body.outputs, 'outputs'),
    notes: body.notes,
  });
  return { phase };
}));

router.get('/projects/:id/phases', inferenceAuth, requireUuid('id'), handleResearch(async (req) => {
  const phases = await listPhases(req.params.id, req);
  return { phases };
}));

// --- Code engine catalog ---

router.get('/code-templates', inferenceAuth, handleResearch(async () => ({
  templates: listTemplates(),
  pipeline: getPipelineOrder(),
})));

// --- AI-powered generation ---

router.post(
  '/projects/:id/generate/literature-search',
  inferenceAuth,
  inferenceRateLimiter,
  requireUuid('id'),
  handleResearch(async (req, res) => {
    const project = await getProjectForGenerate(req.params.id, req);
    const { domain, keywords } = req.body || {};
    const existingPapers = await listPapers(req.params.id, req);
    const basePrompt = buildLiteratureSearchPrompt(
      domain || project.domain,
      keywords || project.research_question || '',
      existingPapers,
    );
    const prompt = await buildAugmentedPrompt(basePrompt, req.user.id, req.params.id);
    await streamGenerate(req, res, prompt, '/api/v1/research/generate/literature-search', {
      max_tokens: 4096,
    });
    return null;
  }),
);

router.post(
  '/projects/:id/generate/math-derivation',
  inferenceAuth,
  inferenceRateLimiter,
  requireUuid('id'),
  handleResearch(async (req, res) => {
    await getProjectForGenerate(req.params.id, req);
    const { block_type, parameters } = req.body || {};
    const params = parseJsonField(parameters, 'parameters') ?? {};
    const basePrompt = buildMathDerivationPrompt(block_type || 'LOA', params);
    const prompt = await buildAugmentedPrompt(basePrompt, req.user.id, req.params.id);
    await streamGenerate(req, res, prompt, '/api/v1/research/generate/math-derivation', {
      max_tokens: 4096,
    });
    return null;
  }),
);

router.post(
  '/projects/:id/generate/code',
  inferenceAuth,
  inferenceRateLimiter,
  requireUuid('id'),
  handleResearch(async (req, res) => {
    const project = await getProjectForGenerate(req.params.id, req);
    const { tool, code_type, parameters } = req.body || {};
    const allowedTools = ['matlab', 'python', 'verilog', 'latex'];
    if (!allowedTools.includes(tool)) {
      throw new ResearchError(`tool must be one of: ${allowedTools.join(', ')}`);
    }
    if (!code_type?.trim()) {
      throw new ResearchError('code_type is required (e.g. loa_adder, verification_suite, full_paper)');
    }
    if (!getTemplate(tool, code_type)) {
      const available = listTemplates()
        .filter((t) => t.tool === tool)
        .map((t) => t.type);
      throw new ResearchError(
        `Unknown code_type "${code_type}" for ${tool}. Available: ${available.join(', ')}`,
      );
    }
    const params = parseJsonField(parameters, 'parameters') ?? {};
    const projectContext = await loadGenerateContext(req.params.id, req, project, params);
    const basePrompt = buildFullCodePrompt(tool, code_type, projectContext);
    const prompt = await buildAugmentedPrompt(basePrompt, req.user.id, req.params.id);
    await streamGenerate(req, res, prompt, '/api/v1/research/generate/code', {
      max_tokens: 8192,
      temperature: 0.3,
    });
    return null;
  }),
);

router.post(
  '/projects/:id/generate/code-review',
  inferenceAuth,
  inferenceRateLimiter,
  requireUuid('id'),
  handleResearch(async (req, res) => {
    await getProjectForGenerate(req.params.id, req);
    const { tool, code } = req.body || {};
    const allowedTools = ['matlab', 'python', 'verilog', 'latex'];
    if (!allowedTools.includes(tool)) {
      throw new ResearchError(`tool must be one of: ${allowedTools.join(', ')}`);
    }
    if (!code?.trim()) {
      throw new ResearchError('code is required');
    }
    const prompt = buildParserPrompt(tool, code);
    await streamGenerate(req, res, prompt, '/api/v1/research/generate/code-review');
    return null;
  }),
);

router.post(
  '/projects/:id/generate/latex-section',
  inferenceAuth,
  inferenceRateLimiter,
  requireUuid('id'),
  handleResearch(async (req, res) => {
    const project = await getProjectForGenerate(req.params.id, req);
    const { section, context, full_manuscript } = req.body || {};

    if (full_manuscript || section === 'full_paper') {
      const projectContext = await loadGenerateContext(req.params.id, req, project);
      const prompt = buildFullCodePrompt('latex', 'full_paper', projectContext);
      await streamGenerate(req, res, prompt, '/api/v1/research/generate/latex-section', {
        max_tokens: 8192,
      });
      return null;
    }

    const allowedSections = ['abstract', 'intro', 'background', 'methodology', 'results', 'conclusion'];
    if (!allowedSections.includes(section)) {
      throw new ResearchError(
        `section must be one of: ${allowedSections.join(', ')}, or set full_manuscript=true`,
      );
    }
    const ctx = parseJsonField(context, 'context') ?? context ?? {};
    const prompt = [
      `Write the "${section}" section in LaTeX for an IEEEtran double-column paper.`,
      `Project title: ${project.title}`,
      `Research question: ${project.research_question || 'N/A'}`,
      `Target journal: ${project.target_journal || 'IEEE TCSVT'}`,
      `Context: ${JSON.stringify(ctx)}`,
      'Use \\begin{equation} for displayed math. No markdown fences.',
    ].join('\n');
    await streamGenerate(req, res, prompt, '/api/v1/research/generate/latex-section', {
      max_tokens: 4096,
    });
    return null;
  }),
);

export default router;
