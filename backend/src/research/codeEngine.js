/**
 * 4-tool code generation engine — MATLAB, Python, Verilog, LaTeX templates
 * for the OWNAI research pipeline (Phases 2–6).
 */

export class CodeEngineError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CodeEngineError';
  }
}

export const MATLAB_TEMPLATES = {
  loa_adder: `
Generate a complete MATLAB file: loa_add.m
Function signature: function [result, error_val] = loa_add(A, B, WL, LPL)
Requirements:
- Handle scalar and matrix inputs (vectorized with bitwise ops)
- Lower LPL bits: result bits = A_bits OR B_bits
- Carry correction: Ccorr = AND of bit (LPL-1) of A and B
- Upper (WL-LPL) bits: exact addition with Ccorr as carry-in
- error_val = result - (A + B) for each element
- Self-test at bottom: WL=8, LPL=3, exhaustive test, assert |ME - (-0.25)| < 0.01
- Print: 'loa_add.m: PASS' on success
  `.trim(),

  error_metrics: `
Generate: loa_error_metrics.m
function metrics = loa_error_metrics(WL, LPL)
- Exhaustive sweep: all 2^(2*WL) combinations (only for WL<=8)
- Compute PE, ME, MSE, MAX from simulation
- Compute theoretical: PE_th=1-(3/4)^LPL, ME_th=-0.25, MSE_th=2^(2*LPL-4)
- Assert agreement within 0.3% for each metric
- Return struct with both measured and theoretical values
- Print table: metric | measured | theoretical | error%
  `.trim(),

  parameter_sweep: `
Generate: parameter_sweep.m
- Sweep nLPL in {0,1,2,3,4,5,6}, HBL in {0,1,2}, VBL in {0,1,2,3,4,5}
- For each combo: run bic_dct on 16-point test, compute PSNR and BD-rate
- Hardware model: GC_LOA(p) = GC_sub(p-nLPL) + (nLPL+1), T_LOA = T_sub + 1
- ADP_reduction = (ADP_ref - ADP_approx)/ADP_ref * 100
- Mark PASS if BD-rate <= 0.5%, FAIL otherwise
- Find Pareto-optimal: max ADP reduction subject to PASS
- Output Table matching: nLPL | HBL | VBL | BD-rate | ADP% | Status
- Save results to sweep_results.mat
  `.trim(),

  bdrate: `
Generate: bdrate_bjontegaard.m
function delta = bdrate_bjontegaard(R1, D1, R2, D2)
- R1,D1: [4x1] rate-distortion for reference (4 QP points)
- R2,D2: [4x1] rate-distortion for proposed
- Fit cubic polynomial to log(R) vs D for each curve
- Integrate both curves over overlapping PSNR range
- Return BD-rate in percent
- Include self-test with known values
  `.trim(),
};

export const PYTHON_TEMPLATES = {
  verification_suite: `
Generate: loa_verify.py
Complete Python/NumPy verification suite.
Functions required:
  loa_numpy(A, B, wl, lpl) -> approx_sum (must match Verilog bit-for-bit)
  compute_metrics_exhaustive(wl, lpl) -> {PE, ME, MSE, MAX, PE_theory, ME_theory, MSE_theory}
  bam_numpy(A, B, mw, nw, hbl, vbl) -> approx_product
  bic_dct_numpy(x, N, transform_type, lpl, hbl, vbl) -> Y
  bdrate(R1, D1, R2, D2) -> float
  validate_theory(wl_range, lpl_range) -> prints table, asserts all within 0.3%
  compare_verilog_dump(hex_file, wl, lpl) -> {mismatches, PE_agreement}

IEEE matplotlib style setup (include at top):
  plt.rcParams['font.family'] = 'serif'
  plt.rcParams['font.serif'] = ['Times New Roman']
  plt.rcParams['font.size'] = 10
  plt.rcParams['figure.dpi'] = 300
  plt.rcParams['savefig.bbox'] = 'tight'

Figure functions:
  fig_pe_vs_lpl() -> saves pe_curve.pdf
  fig_mse_vs_lpl() -> saves mse_curve.pdf
  fig_pareto() -> saves pareto.pdf
  fig_error_histogram(lpl=3) -> saves error_hist.pdf

if __name__ == '__main__': run validate_theory() then all figures
  `.trim(),
};

export const VERILOG_TEMPLATES = {
  loa_adder: `
Generate complete Verilog for loa_adder.v:
module loa_adder #(parameter WL=16, parameter LPL=3)
  (input [WL-1:0] A, B, output [WL:0] S);
Architecture:
- generate block: OR gates for bits 0..LPL-1
- single AND gate: Ccorr = A[LPL-1] & B[LPL-1]
- standard RCA for bits LPL..WL-1 with Ccorr as carry-in
- synthesis attribute: (* keep_hierarchy = "yes" *)
Also generate tb_loa_adder.v:
- exhaustive 8-bit test all 65536 combos
- compute PE, ME, MSE from simulation
- $display PASS/FAIL with values
- assert |ME_sim - (-0.25)| < 0.01 else $fatal
- generate VCD: $dumpfile("loa_tb.vcd") $dumpvars
Also generate Makefile:
  sim: iverilog -o sim tb_loa_adder.v loa_adder.v && vvp sim
  synth: yosys -p "synth -top loa_adder; stat" loa_adder.v
  all: sim synth
  `.trim(),

  tunable_loa: `
Generate: tunable_loa_adder.v
- 3-bit lpl_sel selects nLPL from {2,3,4,4}
- Instantiates 4 loa_adder instances
- Output MUX on lpl_sel
- lpl_sel driven from external MTS LUT port
  `.trim(),

  sau_loa: `
Generate: sau_loa.v - Shift-Add Unit with LOA accumulators
- Generates 5 multiples: 1x, 2x(<<1), 3x(<<1+x), 5x(<<2+x), 6x(<<2+<<1)
- All accumulation adders: tunable_loa_adder instances
- lpl_sel input from MTS LUT
- 5-stage pipeline with registered outputs
  `.trim(),
};

export const LATEX_TEMPLATES = {
  full_paper: `
Generate complete IEEEtran LaTeX paper.
\\documentclass[journal,10pt,twoside]{IEEEtran}
Packages: amsmath,amssymb,amsthm,graphicx,booktabs,multirow,
          algorithm,algpseudocode,tikz,pgfplots,cite,url

Required sections with COMPLETE content (no placeholders):
1. Abstract (exactly 150 words, 6 sentences: motivation/problem/method/result1/result2/significance)
2. Introduction (motivation, prior work 3 paragraphs, contributions bulleted list)
3. Background (addition in VLSI, error metrics with equations, VVC transform basics)
4. Proposed architecture (theorem+proof for PE, ME, MSE — full proof blocks)
5. Integration strategy (zone-partitioned, PCZ vs ATZ, MTS tuning)
6. Simulation framework (MATLAB layers, parameter sweep, Pareto analysis)
7. RTL implementation (LOA Verilog, tunable LOA, SAU integration)
8. Results (Table IV comparison, Table V BD-rate by class, Table VI guidelines)
9. Conclusion (restate 3 analytical results + 2 hardware results + future work)

Math environments: \\begin{theorem}...\\end{theorem} \\begin{proof}...\\end{proof}
Table style: \\toprule \\midrule \\bottomrule from booktabs
All \\cite{} keys use format: authornameYEARkeyword (e.g. mahdiani2010bioinspired)
  `.trim(),
};

const TEMPLATE_MAP = {
  matlab: MATLAB_TEMPLATES,
  python: PYTHON_TEMPLATES,
  verilog: VERILOG_TEMPLATES,
  latex: LATEX_TEMPLATES,
};

const QUALITY_RULES = [
  'Every function has input validation at the top',
  "Every function has a self-test block at the bottom with assert",
  "Print 'FILENAME: PASS' when self-test succeeds",
  'No hardcoded constants — all parameters passed as arguments',
  'Cross-tool consistency: if MATLAB says ME=-0.25, Python must confirm -0.25 ± 0.001',
  'For Verilog: every module has companion testbench in same output',
  'For LaTeX: zero placeholder text — every section has real content',
];

/**
 * @param {'matlab'|'python'|'verilog'|'latex'} tool
 * @param {string} type
 * @returns {string|null}
 */
export function getTemplate(tool, type) {
  const key = String(tool || '').toLowerCase();
  return TEMPLATE_MAP[key]?.[type] ?? null;
}

/**
 * List all available tool/type template keys.
 * @returns {Array<{ tool: string, type: string }>}
 */
export function listTemplates() {
  return Object.entries(TEMPLATE_MAP).flatMap(([tool, types]) =>
    Object.keys(types).map((type) => ({ tool, type })),
  );
}

/**
 * Normalize project context from API/DB shape.
 * @param {object} project
 * @param {object} [extras]
 */
export function buildProjectContext(project = {}, extras = {}) {
  return {
    title: project.title ?? 'Untitled research project',
    domain: project.domain ?? extras.domain ?? 'approximate_computing',
    research_question: project.research_question ?? '',
    target_journal: project.target_journal ?? 'IEEE TCSVT',
    parameters: extras.parameters ?? project.parameters ?? {},
    derivations: extras.derivations ?? project.derivations ?? [],
    simulationResults: extras.simulationResults ?? project.simulationResults ?? [],
  };
}

/**
 * @param {'matlab'|'python'|'verilog'|'latex'} tool
 * @param {string} type
 * @param {object} projectContext
 * @returns {string}
 */
export function buildFullCodePrompt(tool, type, projectContext = {}) {
  const template = getTemplate(tool, type);
  if (!template) {
    const available = listTemplates()
      .filter((t) => t.tool === String(tool).toLowerCase())
      .map((t) => t.type);
    throw new CodeEngineError(
      `Unknown template: ${tool}/${type}. Available for ${tool}: ${available.join(', ') || 'none'}`,
    );
  }

  const ctx = buildProjectContext(projectContext);

  return [
    'You are generating production-quality research code for an IEEE paper.',
    `Project: ${ctx.title}`,
    `Domain: ${ctx.domain}`,
    `Research question: ${ctx.research_question || 'N/A'}`,
    `Target journal: ${ctx.target_journal}`,
    `Key parameters: ${JSON.stringify(ctx.parameters)}`,
    `Validated formulas: ${JSON.stringify(ctx.derivations)}`,
    `Simulation results so far: ${JSON.stringify(ctx.simulationResults)}`,
    '',
    'CODE REQUIREMENTS:',
    template,
    '',
    'QUALITY RULES (non-negotiable):',
    ...QUALITY_RULES.map((rule, i) => `${i + 1}. ${rule}`),
    '',
    'Generate COMPLETE code now. No truncation. No "..." shortcuts.',
  ].join('\n');
}

/**
 * @param {'matlab'|'python'|'verilog'|'latex'} tool
 * @param {string} rawCode
 * @returns {string}
 */
export function buildParserPrompt(tool, rawCode) {
  if (!rawCode?.trim()) {
    throw new CodeEngineError('rawCode is required for code review');
  }
  const lang = String(tool || 'text').toLowerCase();
  return [
    `Review this ${lang} code for an IEEE research paper:`,
    '```',
    rawCode.trim(),
    '```',
    'Check:',
    '1) Input validation present?',
    '2) Self-test with assert present?',
    '3) No hardcoded constants?',
    '4) Matches required function signatures?',
    '5) Cross-tool metrics agree within 0.3% where applicable?',
    '',
    'List any issues found with line references.',
    'If none, respond with exactly: CODE REVIEW: PASS',
  ].join('\n');
}

/**
 * Suggested pipeline order for 4-tool cross-validation.
 * @returns {Array<{ phase: number, tool: string, type: string, description: string }>}
 */
export function getPipelineOrder() {
  return [
    { phase: 2, tool: 'matlab', type: 'loa_adder', description: 'LOA reference model' },
    { phase: 2, tool: 'matlab', type: 'error_metrics', description: 'Theory vs simulation metrics' },
    { phase: 3, tool: 'python', type: 'verification_suite', description: 'Cross-check MATLAB + figures' },
    { phase: 4, tool: 'verilog', type: 'loa_adder', description: 'RTL + testbench + Makefile' },
    { phase: 4, tool: 'verilog', type: 'tunable_loa', description: 'MTS-tunable LOA' },
    { phase: 4, tool: 'verilog', type: 'sau_loa', description: 'Shift-add unit integration' },
    { phase: 3, tool: 'matlab', type: 'parameter_sweep', description: 'Pareto sweep' },
    { phase: 3, tool: 'matlab', type: 'bdrate', description: 'BD-rate calculator' },
    { phase: 6, tool: 'latex', type: 'full_paper', description: 'Complete IEEEtran manuscript' },
  ];
}
