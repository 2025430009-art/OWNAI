/**
 * Simulation tracking and MATLAB→Python→Verilog cross-validation engine.
 */

export class SimulationEngineError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SimulationEngineError';
  }
}

export const PARAMETER_CONSTRAINTS = {
  nLPL: { min: 0, max: 6, optimal: 3 },
  HBL: { min: 0, max: 2, optimal: 1 },
  VBL: { min: 0, max: 5, optimal: 4 },
  WL: { min: 4, max: 32, typical: 16 },
  BD_RATE_BUDGET: 0.5,
  AGREEMENT_THRESHOLD: 0.3,
};

const CROSS_VALIDATION_METRICS = ['PE', 'ME', 'MSE'];

/**
 * @returns {Array<{ nLPL: number, HBL: number, VBL: number }>}
 */
export function buildSweepParameters() {
  const combos = [];
  for (let nLPL = 0; nLPL <= PARAMETER_CONSTRAINTS.nLPL.max; nLPL += 1) {
    for (let HBL = 0; HBL <= PARAMETER_CONSTRAINTS.HBL.max; HBL += 1) {
      for (let VBL = 0; VBL <= PARAMETER_CONSTRAINTS.VBL.max; VBL += 1) {
        combos.push({ nLPL, HBL, VBL });
      }
    }
  }

  return combos.sort((a, b) => {
    const exactA = a.nLPL === 0 && a.HBL === 0 && a.VBL === 0;
    const exactB = b.nLPL === 0 && b.HBL === 0 && b.VBL === 0;
    if (exactA && !exactB) return -1;
    if (!exactA && exactB) return 1;
    if (a.nLPL !== b.nLPL) return a.nLPL - b.nLPL;
    if (a.HBL !== b.HBL) return a.HBL - b.HBL;
    return a.VBL - b.VBL;
  });
}

/**
 * @param {number} nLPL
 * @param {number} [WL=16]
 * @returns {{ PE: number, ME: number, MSE: number, MAX: number, MIN: number, GC_LOA: number, GC_exact: number, GC_savings_pct: number }}
 */
export function computeTheoreticalMetrics(nLPL, WL = PARAMETER_CONSTRAINTS.WL.typical) {
  const PE = 1 - (3 / 4) ** nLPL;
  const ME = -0.25;
  const MSE = 2 ** (2 * nLPL - 4);
  const MAX = 2 ** (nLPL - 1) - 1;
  const MIN = -(2 ** (nLPL - 1));
  const GC_LOA = (WL - nLPL) + (nLPL + 1);
  const GC_exact = WL;
  const GC_savings_pct = ((GC_exact - GC_LOA) / GC_exact) * 100;

  return { PE, ME, MSE, MAX, MIN, GC_LOA, GC_exact, GC_savings_pct };
}

/**
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
export function relativeErrorPercent(a, b) {
  if (a === b) return 0;
  const denom = Math.abs(a) || Math.abs(b) || 1;
  return (Math.abs(a - b) / denom) * 100;
}

/**
 * @param {Record<string, number>} theoretical
 * @param {Record<string, number>} simulated
 * @returns {Array<{ metric: string, theory: number, simulated: number, error_pct: number, pass: boolean }>}
 */
export function validateAgreement(theoretical, simulated) {
  return CROSS_VALIDATION_METRICS.map((metric) => {
    const theory = theoretical[metric];
    const sim = simulated[metric];

    if (typeof theory !== 'number' || typeof sim !== 'number') {
      throw new SimulationEngineError(`Missing numeric value for metric "${metric}"`);
    }

    let errorPct = 0;
    if (theory === 0 && sim === 0) {
      errorPct = 0;
    } else {
      const denom = Math.abs(theory) || Math.abs(sim) || 1;
      errorPct = (Math.abs(theory - sim) / denom) * 100;
    }

    return {
      metric,
      theory,
      simulated: sim,
      error_pct: errorPct,
      pass: errorPct < PARAMETER_CONSTRAINTS.AGREEMENT_THRESHOLD,
    };
  });
}

/**
 * @param {Array<{ nLPL: number, HBL: number, VBL: number, bd_rate: number, adp_savings: number }>} sweepResults
 * @returns {Array<{ nLPL: number, HBL: number, VBL: number, bd_rate: number, adp_savings: number }>}
 */
export function computeParetoFront(sweepResults) {
  if (!Array.isArray(sweepResults) || !sweepResults.length) {
    return [];
  }

  const passing = sweepResults.filter(
    (row) => typeof row.bd_rate === 'number'
      && row.bd_rate <= PARAMETER_CONSTRAINTS.BD_RATE_BUDGET,
  );

  return passing.filter((point) => !passing.some((other) => (
    other !== point
    && other.adp_savings > point.adp_savings
    && other.bd_rate <= point.bd_rate
  )));
}

/**
 * @param {Array<{ adp_savings: number }>} paretoFront
 * @returns {{ adp_savings: number }|null}
 */
export function findOptimalPoint(paretoFront) {
  if (!Array.isArray(paretoFront) || !paretoFront.length) {
    return null;
  }

  return paretoFront.reduce(
    (best, row) => (row.adp_savings > best.adp_savings ? row : best),
    paretoFront[0],
  );
}

/**
 * @returns {{ nLPL: number, HBL: number, VBL: number }}
 */
export function getTheoreticalOptimal() {
  return {
    nLPL: PARAMETER_CONSTRAINTS.nLPL.optimal,
    HBL: PARAMETER_CONSTRAINTS.HBL.optimal,
    VBL: PARAMETER_CONSTRAINTS.VBL.optimal,
  };
}

/**
 * @param {Record<string, number>} matlabResults
 * @param {Record<string, number>} pythonResults
 * @param {Record<string, number>} verilogResults
 * @returns {{ rows: object[], all_pass: boolean, critical_mismatches: string[] }}
 */
export function buildCrossValidationReport(matlabResults, pythonResults, verilogResults) {
  const tools = {
    matlab: matlabResults,
    python: pythonResults,
    verilog: verilogResults,
  };

  const rows = CROSS_VALIDATION_METRICS.map((metric) => {
    const values = {
      matlab: tools.matlab[metric],
      python: tools.python[metric],
      verilog: tools.verilog[metric],
    };

    for (const [tool, value] of Object.entries(values)) {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        throw new SimulationEngineError(`Missing numeric "${metric}" in ${tool} results`);
      }
    }

    const pairDeviations = [
      { pair: 'matlab-python', error_pct: relativeErrorPercent(values.matlab, values.python) },
      { pair: 'matlab-verilog', error_pct: relativeErrorPercent(values.matlab, values.verilog) },
      { pair: 'python-verilog', error_pct: relativeErrorPercent(values.python, values.verilog) },
    ];

    const maxDeviation = Math.max(...pairDeviations.map((entry) => entry.error_pct));

    return {
      metric,
      matlab: values.matlab,
      python: values.python,
      verilog: values.verilog,
      max_deviation: maxDeviation,
      pair_deviations: pairDeviations,
      pass: maxDeviation < PARAMETER_CONSTRAINTS.AGREEMENT_THRESHOLD,
    };
  });

  const criticalMismatches = rows.filter((row) => !row.pass).map((row) => row.metric);

  return {
    rows,
    all_pass: rows.every((row) => row.pass),
    critical_mismatches: criticalMismatches,
  };
}

/**
 * @param {object} projectContext
 * @param {{ nLPL?: number, HBL?: number, VBL?: number, WL?: number }} runParams
 * @returns {string}
 */
export function buildSimulationPrompt(projectContext = {}, runParams = {}) {
  const nLPL = runParams.nLPL ?? PARAMETER_CONSTRAINTS.nLPL.optimal;
  const HBL = runParams.HBL ?? PARAMETER_CONSTRAINTS.HBL.optimal;
  const VBL = runParams.VBL ?? PARAMETER_CONSTRAINTS.VBL.optimal;
  const WL = runParams.WL ?? PARAMETER_CONSTRAINTS.WL.typical;

  const theoretical = computeTheoreticalMetrics(nLPL, WL);
  const ctx = {
    title: projectContext.title ?? 'Untitled research project',
    domain: projectContext.domain ?? 'approximate_computing',
    research_question: projectContext.research_question ?? '',
    derivations: projectContext.derivations ?? [],
    simulationResults: projectContext.simulationResults ?? [],
  };

  return [
    'You are an IEEE simulation reviewer for the OWNAI research pipeline.',
    'Pre-validate expected MATLAB simulation output before running expensive sweeps.',
    '',
    `Project: ${ctx.title}`,
    `Domain: ${ctx.domain}`,
    `Research question: ${ctx.research_question || 'N/A'}`,
    `Validated formulas: ${JSON.stringify(ctx.derivations)}`,
    `Prior simulation results: ${JSON.stringify(ctx.simulationResults)}`,
    '',
    'Run parameters:',
    `  nLPL=${nLPL}, HBL=${HBL}, VBL=${VBL}, WL=${WL}`,
    '',
    'Closed-form theoretical predictions (must match within 0.3%):',
    `  PE   = ${theoretical.PE}`,
    `  ME   = ${theoretical.ME}`,
    `  MSE  = ${theoretical.MSE}`,
    `  MAX  = ${theoretical.MAX}`,
    `  MIN  = ${theoretical.MIN}`,
    `  GC_LOA = ${theoretical.GC_LOA}, GC_exact = ${theoretical.GC_exact}, GC_savings = ${theoretical.GC_savings_pct.toFixed(2)}%`,
    '',
    'Tasks:',
    '1. Predict the MATLAB exhaustive-simulation metrics (PE, ME, MSE) for these parameters.',
    '2. Predict Python cross-check values — must agree with MATLAB within 0.3%.',
    '3. Predict Verilog simulation metrics — must agree with MATLAB within 0.3%.',
    '4. Identify likely failure modes (parameter typos, bit-width overflow, wrong LPL indexing, BD-rate integration range).',
    '5. State PASS/FAIL for each tool pair against the 0.3% agreement threshold.',
    '',
    'Respond with JSON:',
    '{',
    '  "predicted": { "matlab": { "PE": 0, "ME": 0, "MSE": 0 }, "python": {}, "verilog": {} },',
    '  "failure_modes": ["..."],',
    '  "pre_validation_pass": true',
    '}',
  ].join('\n');
}

/**
 * @param {Array<object>} sweepResults
 * @returns {{ pareto_front: object[], optimal_point: object|null, theoretical_optimal: object }}
 */
export function analyzeParetoSweep(sweepResults) {
  const paretoFront = computeParetoFront(sweepResults);
  const optimalPoint = findOptimalPoint(paretoFront);

  return {
    pareto_front: paretoFront,
    optimal_point: optimalPoint,
    theoretical_optimal: getTheoreticalOptimal(),
  };
}
