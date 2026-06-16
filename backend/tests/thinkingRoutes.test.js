import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeModeInput } from '../src/routes/thinking.js';

describe('thinking routes helpers', () => {
  it('normalizeModeInput resolves shorthand aliases', () => {
    assert.equal(normalizeModeInput('cot'), 'chain_of_thought');
    assert.equal(normalizeModeInput('tot'), 'tree_of_thoughts');
    assert.equal(normalizeModeInput('self_refine'), 'self_refine');
  });

  it('normalizeModeInput returns null for unknown mode', () => {
    assert.equal(normalizeModeInput('unknown_mode'), null);
  });
});
