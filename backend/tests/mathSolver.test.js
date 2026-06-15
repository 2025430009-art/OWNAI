import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  solveQuadratic,
  solveLinearSystem2x2,
  computeDerivative,
  integrateSimpson,
  computeStatistics,
  solveNewtonRaphson,
  MathSolverError,
} from '../src/services/mathSolver.js';

describe('solveQuadratic', () => {
  it('returns two distinct real roots', () => {
    const result = solveQuadratic(1, -5, 6);
    assert.equal(result.nature, 'two_distinct_real');
    assert.equal(result.roots.length, 2);
    assert.ok(Math.abs(result.roots[0].real - 3) < 1e-9);
    assert.ok(Math.abs(result.roots[1].real - 2) < 1e-9);
  });

  it('returns one repeated real root', () => {
    const result = solveQuadratic(1, -4, 4);
    assert.equal(result.nature, 'one_repeated_real');
    assert.ok(Math.abs(result.roots[0].real - 2) < 1e-9);
  });

  it('returns complex conjugate roots', () => {
    const result = solveQuadratic(1, 0, 1);
    assert.equal(result.nature, 'two_complex_conjugate');
    assert.ok(Math.abs(result.roots[0].real) < 1e-9);
    assert.ok(Math.abs(result.roots[0].imaginary - 1) < 1e-9);
  });

  it('throws when a is zero', () => {
    assert.throws(() => solveQuadratic(0, 2, 3), MathSolverError);
  });
});

describe('solveLinearSystem2x2', () => {
  it('solves unique solution via Cramers rule', () => {
    const result = solveLinearSystem2x2(2, 1, 5, 1, 1, 3);
    assert.equal(result.type, 'unique_solution');
    assert.ok(Math.abs(result.solution.x - 2) < 1e-9);
    assert.ok(Math.abs(result.solution.y - 1) < 1e-9);
  });

  it('detects parallel lines', () => {
    const result = solveLinearSystem2x2(1, 2, 3, 2, 4, 7);
    assert.equal(result.type, 'no_solution');
  });

  it('detects coincident lines', () => {
    const result = solveLinearSystem2x2(1, 2, 3, 2, 4, 6);
    assert.equal(result.type, 'infinite_solutions');
  });
});

describe('computeDerivative', () => {
  it('differentiates polynomial x^2', () => {
    const result = computeDerivative('x^2');
    assert.equal(result.derivative, '(2*x)');
  });

  it('differentiates sin(x)', () => {
    const result = computeDerivative('sin(x)');
    assert.equal(result.derivative, 'cos(x)');
  });

  it('differentiates product 3*x^2', () => {
    const result = computeDerivative('3*x^2');
    assert.ok(result.derivative.includes('6'));
  });
});

describe('integrateSimpson', () => {
  it('approximates integral of x^2 from 0 to 1', () => {
    const result = integrateSimpson('x^2', 0, 1, 100);
    assert.ok(Math.abs(result.approximate_value - 1 / 3) < 0.001);
  });

  it('throws when n is odd', () => {
    assert.throws(() => integrateSimpson('x', 0, 1, 3), MathSolverError);
  });

  it('throws when a >= b', () => {
    assert.throws(() => integrateSimpson('x', 1, 0, 4), MathSolverError);
  });
});

describe('computeStatistics', () => {
  it('computes mean median mode variance', () => {
    const result = computeStatistics([1, 2, 2, 3]);
    assert.equal(result.mean, 2);
    assert.equal(result.median, 2);
    assert.deepEqual(result.mode, [2]);
    assert.ok(result.variance >= 0);
  });

  it('computes linear regression', () => {
    const result = computeStatistics([1, 2, 3], [0, 1, 2], [1, 3, 5]);
    assert.ok(result.linear_regression);
    assert.ok(Math.abs(result.linear_regression.slope - 2) < 1e-9);
    assert.ok(Math.abs(result.linear_regression.intercept - 1) < 1e-9);
  });

  it('throws on empty data', () => {
    assert.throws(() => computeStatistics([]), MathSolverError);
  });
});

describe('solveNewtonRaphson', () => {
  it('finds root of x^2 - 4 near 2 from initial guess 3', () => {
    const result = solveNewtonRaphson('x^2 - 4', 3, 0.0001, 100);
    assert.equal(result.converged, true);
    assert.equal(result.method, 'newton_raphson');
    assert.ok(Math.abs(result.root - 2) < 0.0001);
    assert.ok(Math.abs(result.function_value_at_root) < 0.0001);
  });

  it('finds root of cos(x) - x near 0.739', () => {
    const result = solveNewtonRaphson('cos(x) - x', 0.5, 0.0001, 100);
    assert.equal(result.converged, true);
    assert.ok(Math.abs(result.root - 0.7390851332) < 0.0001);
  });

  it('detects initial guess as root', () => {
    const result = solveNewtonRaphson('x^2 - 4', 2, 0.0001, 100);
    assert.equal(result.converged, true);
    assert.equal(result.iterations, 0);
    assert.ok(Math.abs(result.root - 2) < 1e-9);
  });

  it('falls back to secant when derivative is zero at guess', () => {
    const result = solveNewtonRaphson('x^2 - 4', 0, 0.0001, 100);
    assert.equal(result.converged, true);
    assert.ok(result.method === 'secant' || result.status === 'fallback_to_secant');
    assert.ok(Math.abs(Math.abs(result.root) - 2) < 0.0001);
  });

  it('reports non-convergence within iteration limit', () => {
    const result = solveNewtonRaphson('cos(x) - x', 0.5, 1e-12, 1);
    assert.equal(result.converged, false);
    assert.equal(result.status, 'non_converged');
  });

  it('throws on invalid tolerance', () => {
    assert.throws(() => solveNewtonRaphson('x^2 - 4', 3, 0, 100), MathSolverError);
  });
});
