import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSafeObjective, SafeExpressionError } from '../src/utils/safeExpression.js';

describe('safeExpression', () => {
  it('evaluates simple expressions', () => {
    const fn = buildSafeObjective('x^2', 1);
    assert.equal(fn([3]), 9);
  });

  it('evaluates multi-variable expressions', () => {
    const fn = buildSafeObjective('x0^2 + x1^2', 2);
    assert.equal(fn([3, 4]), 25);
  });

  it('rejects code injection attempts', () => {
    assert.throws(
      () => buildSafeObjective('process.exit(1)', 1),
      SafeExpressionError,
    );
  });

  it('rejects disallowed characters', () => {
    assert.throws(
      () => buildSafeObjective('x; alert(1)', 1),
      SafeExpressionError,
    );
  });
});
