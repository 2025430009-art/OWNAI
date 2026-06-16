import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PARAMETER_CONSTRAINTS,
  buildSweepParameters,
  computeTheoreticalMetrics,
  validateAgreement,
  computeParetoFront,
  findOptimalPoint,
  buildCrossValidationReport,
  analyzeParetoSweep,
  getTheoreticalOptimal,
  SimulationEngineError,
} from '../src/research/simulationEngine.js';

describe('simulationEngine', () => {
  it('buildSweepParameters returns 126 sorted combinations', () => {
    const combos = buildSweepParameters();
    assert.equal(combos.length, 126);
    assert.deepEqual(combos[0], { nLPL: 0, HBL: 0, VBL: 0 });
    assert.ok(combos[1].nLPL >= combos[0].nLPL);
  });

  it('computeTheoreticalMetrics matches LOA closed forms at nLPL=3', () => {
    const metrics = computeTheoreticalMetrics(3, 16);
    assert.ok(Math.abs(metrics.PE - (1 - (3 / 4) ** 3)) < 1e-12);
    assert.equal(metrics.ME, -0.25);
    assert.equal(metrics.MSE, 2 ** (2 * 3 - 4));
    assert.equal(metrics.MAX, 2 ** 2 - 1);
    assert.equal(metrics.MIN, -(2 ** 2));
  });

  it('validateAgreement passes when simulation matches theory', () => {
    const theory = computeTheoreticalMetrics(3);
    const results = validateAgreement(theory, { PE: theory.PE, ME: theory.ME, MSE: theory.MSE });
    assert.ok(results.every((row) => row.pass));
  });

  it('validateAgreement fails when deviation exceeds threshold', () => {
    const theory = computeTheoreticalMetrics(3);
    const results = validateAgreement(theory, { PE: theory.PE, ME: 0, MSE: theory.MSE });
    const meRow = results.find((row) => row.metric === 'ME');
    assert.equal(meRow.pass, false);
    assert.ok(meRow.error_pct > PARAMETER_CONSTRAINTS.AGREEMENT_THRESHOLD);
  });

  it('computeParetoFront filters by BD-rate budget and dominance', () => {
    const sweep = [
      { nLPL: 0, HBL: 0, VBL: 0, bd_rate: 0.1, adp_savings: 10 },
      { nLPL: 1, HBL: 0, VBL: 0, bd_rate: 0.2, adp_savings: 20 },
      { nLPL: 2, HBL: 0, VBL: 0, bd_rate: 0.2, adp_savings: 15 },
      { nLPL: 3, HBL: 0, VBL: 0, bd_rate: 0.8, adp_savings: 50 },
    ];

    const front = computeParetoFront(sweep);
    assert.equal(front.length, 2);
    assert.ok(front.some((row) => row.nLPL === 1));
    assert.ok(!front.some((row) => row.nLPL === 2));
    assert.ok(!front.some((row) => row.nLPL === 3));
  });

  it('findOptimalPoint picks max ADP savings on Pareto front', () => {
    const front = [
      { nLPL: 0, bd_rate: 0.1, adp_savings: 10 },
      { nLPL: 1, bd_rate: 0.2, adp_savings: 25 },
    ];
    const optimal = findOptimalPoint(front);
    assert.equal(optimal.nLPL, 1);
    assert.equal(optimal.adp_savings, 25);
  });

  it('buildCrossValidationReport flags tool mismatches', () => {
    const base = computeTheoreticalMetrics(3);
    const report = buildCrossValidationReport(
      { PE: base.PE, ME: base.ME, MSE: base.MSE },
      { PE: base.PE, ME: base.ME, MSE: base.MSE },
      { PE: base.PE, ME: 0, MSE: base.MSE },
    );

    assert.equal(report.all_pass, false);
    assert.deepEqual(report.critical_mismatches, ['ME']);
    assert.equal(report.rows.length, 3);
  });

  it('buildCrossValidationReport throws on missing metrics', () => {
    assert.throws(
      () => buildCrossValidationReport({ PE: 0.1 }, { PE: 0.1 }, { PE: 0.1 }),
      SimulationEngineError,
    );
  });

  it('analyzeParetoSweep returns theoretical optimal defaults', () => {
    const analysis = analyzeParetoSweep([
      { nLPL: 3, HBL: 1, VBL: 4, bd_rate: 0.2, adp_savings: 30 },
      { nLPL: 2, HBL: 0, VBL: 0, bd_rate: 0.1, adp_savings: 20 },
    ]);

    assert.deepEqual(analysis.theoretical_optimal, getTheoreticalOptimal());
    assert.equal(analysis.optimal_point.nLPL, 3);
  });
});
