import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectTask, INTELLIGENCE_MODES } from '../src/utils/modelRouter.js';

describe('modelRouter', () => {
  it('routes code tasks to DEEP mode', () => {
    const result = detectTask('fix this javascript bug in my function');
    assert.equal(result.mode, INTELLIGENCE_MODES.DEEP);
    assert.equal(result.model, 'qwen2.5:7b');
  });

  it('routes reasoning tasks to THINK mode', () => {
    const result = detectTask('why does this happen? analyze the issue');
    assert.equal(result.mode, INTELLIGENCE_MODES.THINK);
    assert.equal(result.model, 'deepseek-r1:7b');
  });

  it('routes writing tasks to CREATE mode', () => {
    const result = detectTask('write an email to my team');
    assert.equal(result.mode, INTELLIGENCE_MODES.CREATE);
    assert.equal(result.model, 'mistral');
  });

  it('defaults to FAST mode', () => {
    const result = detectTask('hello');
    assert.equal(result.mode, INTELLIGENCE_MODES.FAST);
    assert.equal(result.model, 'llama3.1:8b');
  });
});
