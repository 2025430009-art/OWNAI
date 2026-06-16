/**
 * Phase 2+ — mathematical derivation, validation, and code-generation prompts.
 */

export class MathEngineError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MathEngineError';
  }
}

const BLOCK_TYPES = new Set(['LOA', 'BAM', 'ETA', 'custom']);
const TOOLS = new Set(['matlab', 'python', 'verilog', 'latex']);

const DERIVATION_JSON_SCHEMA = `{
  "derivations": [{
    "metric": "PE|ME|MSE|MAX|GC|T",
    "theorem": "string",
    "proof_steps": ["step1", "step2"],
    "formula_latex": "string",
    "closed_form": "string",
    "independence_condition": "string"
  }]
}`;

const TOOL_RULES = {
  matlab: 'Generate complete MATLAB. Every function: input validation + self-test assert block at bottom. Print \'PASS\' on success. No hardcoded constants.',
  python: 'Generate complete Python/NumPy. Must match MATLAB output within 0.3%. IEEE matplotlib style: 300 DPI, Times font, 8cm wide. Include assert statements.',
  verilog: 'Generate synthesisable Verilog. Use parameters not constants. Include companion testbench module. Add synthesis attributes. Compatible with Yosys + Icarus Verilog.',
  latex: 'Generate complete IEEEtran LaTeX. Use \\begin{theorem}...\\end{proof}. Every equation numbered. \\toprule/\\midrule/\\bottomrule for tables. No placeholder text.',
};

/**
 * @param {'LOA'|'BAM'|'ETA'|'custom'} blockType
 * @param {{ WL?: number, nLPL?: number, HBL?: number, VBL?: number, name?: string }} parameters
 * @returns {string}
 */
export function buildMathDerivationPrompt(blockType, parameters = {}) {
  const type = String(blockType || 'custom').toUpperCase();
  if (!BLOCK_TYPES.has(type)) {
    throw new MathEngineError(`blockType must be one of: ${[...BLOCK_TYPES].join(', ')}`);
  }

  const WL = parameters.WL ?? parameters.word_length ?? 16;
  const nLPL = parameters.nLPL ?? parameters.k ?? 4;
  const HBL = parameters.HBL ?? 8;
  const VBL = parameters.VBL ?? 16;
  const name = parameters.name ?? `${type}_block`;

  const blockContext = {
    LOA: [
      'Lower-Part-OR adder: imprecise lower nLPL bits via OR, accurate upper (WL−nLPL) bits via carry-propagate adder.',
      'Derive PE (probability of error), ME (mean error), MSE, MAX error as functions of nLPL and input distribution.',
      'Gate count: GC = GC_OR(nLPL) + GC_ACC(WL−nLPL). Critical path: T = T_AND + T_ACC(WL−nLPL).',
    ],
    BAM: [
      'Broken-Array Multiplier: omit partial products above HBL rows and right of VBL columns.',
      'Derive error metrics from truncated partial-product mass. NMED and MED as functions of HBL, VBL, WL.',
      'Gate count scales with retained partial-product array area. Critical path through surviving reduction tree.',
    ],
    ETA: [
      'Error-Tolerant Adder: segmented accurate/inaccurate regions with truncated carry propagation.',
      'Derive PE, ME, MSE from segmentation boundary nLPL and carry prediction failure probability.',
    ],
    custom: [
      'Custom approximate arithmetic block — derive all metrics from first principles given parameters.',
    ],
  };

  return [
    'You are an IEEE mathematics reviewer. Derive results from FIRST PRINCIPLES — do not assume formulas without proof.',
    '',
    `Block type: ${type}`,
    `Block name: ${name}`,
    `Parameters: WL=${WL}, nLPL=${nLPL}, HBL=${HBL}, VBL=${VBL}`,
    '',
    ...blockContext[type],
    '',
    'Required derivations (each as a separate entry):',
    '- PE: probability of error (theorem + proof + closed-form LaTeX)',
    '- ME: mean error magnitude',
    '- MSE: mean squared error',
    '- MAX: maximum error bound',
    '- GC: gate count formula GC(p) as function of parameters',
    '- T: critical path delay T(p) in terms of logic depth',
    '',
    'Each derivation must include independence_condition stating when the formula holds.',
    '',
    'Respond with ONLY valid JSON matching:',
    DERIVATION_JSON_SCHEMA,
    '',
    'Rules:',
    '- proof_steps: array of strings, each a logical step (minimum 3 steps per metric).',
    '- formula_latex: single primary result equation using WL, nLPL, HBL, VBL symbols.',
    '- No markdown fences. No placeholder text.',
  ].join('\n');
}

/**
 * @param {object} derivation
 * @param {object} simulationResults
 * @returns {string}
 */
export function buildValidationPrompt(derivation, simulationResults) {
  if (!derivation || typeof derivation !== 'object') {
    throw new MathEngineError('derivation object is required');
  }
  if (!simulationResults || typeof simulationResults !== 'object') {
    throw new MathEngineError('simulationResults object is required');
  }

  const metric = derivation.metric ?? derivation.name ?? 'unknown';
  const formula = derivation.formula_latex ?? derivation.closed_form ?? 'N/A';
  const simValue = simulationResults[metric]
    ?? simulationResults[metric?.toLowerCase()]
    ?? simulationResults.value
    ?? 'N/A';

  return [
    'You are validating a theoretical derivation against simulation data for an IEEE paper.',
    '',
    `Metric: ${metric}`,
    `Theoretical formula (LaTeX): ${formula}`,
    `Theorem: ${derivation.theorem ?? 'N/A'}`,
    `Proof steps: ${JSON.stringify(derivation.proof_steps ?? [])}`,
    '',
    'Simulation results:',
    JSON.stringify(simulationResults, null, 2),
    `Simulated ${metric}: ${simValue}`,
    '',
    'Tasks:',
    '1. Substitute simulation parameters into the theoretical formula and compute the predicted value.',
    '2. Compare predicted vs simulated; compute agreement percentage (100% = exact match).',
    '3. Explain any discrepancy (>0.3% tolerance threshold).',
    '4. State CONFIRMED or REJECTED for the derivation.',
    '',
    'Respond with ONLY valid JSON:',
    '{',
    '  "metric": "string",',
    '  "theoretical_value": number,',
    '  "simulated_value": number,',
    '  "agreement_percent": number,',
    '  "discrepancy_explanation": "string",',
    '  "validated": boolean,',
    '  "recommendation": "string"',
    '}',
  ].join('\n');
}

function formatProjectContext(projectContext = {}) {
  const parts = [];
  if (projectContext.title) parts.push(`Title: ${projectContext.title}`);
  if (projectContext.domain) parts.push(`Domain: ${projectContext.domain}`);
  if (projectContext.research_question) parts.push(`Research question: ${projectContext.research_question}`);
  if (Array.isArray(projectContext.derivations) && projectContext.derivations.length) {
    parts.push(`Derivations: ${JSON.stringify(projectContext.derivations.slice(0, 5))}`);
  }
  if (projectContext.results) {
    parts.push(`Latest results: ${JSON.stringify(projectContext.results)}`);
  }
  return parts.join('\n');
}

function codeTypeSignatures(codeType, tool) {
  const map = {
    adder_model: {
      matlab: 'function stats = loa_model(WL, nLPL, num_samples)',
      python: 'def loa_model(wl: int, nlpl: int, num_samples: int) -> dict',
      verilog: 'module loa_adder #(parameter WL=16, parameter NLPL=4)',
      latex: '\\section{Adder Model} with equation environment for PE/ME/MSE',
    },
    sweep: {
      matlab: 'function results = param_sweep(param_ranges, metrics)',
      python: 'def param_sweep(param_ranges: dict) -> list[dict]',
      verilog: 'testbench module exercising parameter sweep via generate loop',
      latex: 'Results table with \\toprule/\\midrule/\\bottomrule',
    },
    testbench: {
      verilog: 'module tb_<name> with self-checking tasks and $display PASS/FAIL',
    },
    paper_section: {
      latex: 'Full \\section{} with \\begin{theorem}...\\end{proof} blocks',
    },
  };
  return map[codeType]?.[tool] ?? `Implement ${codeType} for ${tool}`;
}

/**
 * @param {'matlab'|'python'|'verilog'|'latex'} tool
 * @param {string} codeType
 * @param {object} parameters
 * @param {object} projectContext
 * @returns {string}
 */
export function buildCodeGenPrompt(tool, codeType, parameters = {}, projectContext = {}) {
  const normalizedTool = String(tool || '').toLowerCase();
  if (!TOOLS.has(normalizedTool)) {
    throw new MathEngineError(`tool must be one of: ${[...TOOLS].join(', ')}`);
  }
  if (!codeType?.trim()) {
    throw new MathEngineError('codeType is required');
  }

  const paramLines = Object.entries(parameters)
    .map(([k, v]) => `  ${k} = ${JSON.stringify(v)}`)
    .join('\n');

  const signature = codeTypeSignatures(codeType, normalizedTool);

  return [
    'You are generating research code for an IEEE paper pipeline (OWNAI).',
    '',
    `Target tool: ${normalizedTool}`,
    `Code type: ${codeType}`,
    '',
    'Project context:',
    formatProjectContext(projectContext) || 'N/A',
    '',
    'Parameters (derive all constants from these — never hardcode):',
    paramLines || '  (none — use sensible parameter struct)',
    '',
    'Required function signature / module:',
    signature,
    '',
    'Tool-specific rules:',
    TOOL_RULES[normalizedTool],
    '',
    'Cross-tool consistency:',
    '- MATLAB and Python implementations must agree within 0.3% on PE, ME, MSE, BD-rate metrics.',
    '- Verilog parameters (WL, NLPL, HBL, VBL) must match simulation parameter names.',
    '- LaTeX must reference the same symbols as the derivation JSON.',
    '',
    'Output requirements:',
    '- Complete runnable code (not snippets).',
    '- Input validation on all function entry points.',
    '- Self-test block at file bottom that asserts expected behavior and prints PASS.',
    normalizedTool === 'verilog' ? '- Include companion testbench in a separate module block.' : '',
    normalizedTool === 'latex' ? '- Use IEEEtran document class conventions.' : '',
    '',
    'Return ONLY the code (no markdown fences unless tool is latex with pure LaTeX output).',
  ].filter(Boolean).join('\n');
}

export { TOOL_RULES };
