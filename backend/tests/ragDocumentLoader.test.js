import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { chunkText } from '../src/rag/documentLoader.js';

describe('documentLoader chunkText', () => {
  it('splits long text into chunks', () => {
    const text = 'a'.repeat(1200);
    const chunks = chunkText(text, 500);
    assert.ok(chunks.length >= 2);
    assert.ok(chunks.every((c) => c.length <= 500));
  });

  it('preserves paragraph boundaries when possible', () => {
    const text = 'First paragraph.\n\nSecond paragraph with more words.';
    const chunks = chunkText(text, 200);
    assert.equal(chunks.length, 1);
    assert.ok(chunks[0].includes('First'));
    assert.ok(chunks[0].includes('Second'));
  });

  it('returns empty array for blank input', () => {
    assert.deepEqual(chunkText('   '), []);
  });
});
