import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MEMORY_TYPES,
  EDGE_RELATIONS,
  parseMemoryExtraction,
  buildMemoryContext,
  applyMemoryPrefixToHistory,
  scheduleMemoryExtraction,
} from '../src/ai/memoryEngine.js';

describe('memoryEngine — parsing and context', () => {
  it('exports memory and edge type constants', () => {
    assert.equal(MEMORY_TYPES.length, 5);
    assert.equal(EDGE_RELATIONS.length, 5);
  });

  it('parseMemoryExtraction parses memories and edges', () => {
    const raw = JSON.stringify({
      memories: [{ type: 'preference', content: 'Prefers LaTeX', confidence: 0.9, tags: ['research'] }],
      edges: [{ from_content: 'A', to_content: 'B', relation: 'related_to', strength: 0.7 }],
    });
    const parsed = parseMemoryExtraction(raw);
    assert.equal(parsed.memories.length, 1);
    assert.equal(parsed.edges.length, 1);
  });

  it('parseMemoryExtraction returns empty on invalid JSON', () => {
    const parsed = parseMemoryExtraction('not json');
    assert.deepEqual(parsed, { memories: [], edges: [] });
  });

  it('buildMemoryContext returns empty string without memories', async () => {
    const context = await buildMemoryContext('Hello world', 999999);
    assert.equal(context, '');
  });

  it('applyMemoryPrefixToHistory prepends to existing system message', () => {
    const history = [
      { role: 'system', content: 'Base prompt' },
      { role: 'user', content: 'Hi' },
    ];
    const updated = applyMemoryPrefixToHistory(history, 'MEMORY BLOCK');
    assert.match(updated[0].content, /MEMORY BLOCK/);
    assert.match(updated[0].content, /Base prompt/);
  });

  it('applyMemoryPrefixToHistory adds system message when missing', () => {
    const updated = applyMemoryPrefixToHistory(
      [{ role: 'user', content: 'Hi' }],
      'MEMORY BLOCK',
    );
    assert.equal(updated[0].role, 'system');
    assert.match(updated[0].content, /MEMORY BLOCK/);
  });

  it('scheduleMemoryExtraction does not throw without user', () => {
    assert.doesNotThrow(() => {
      scheduleMemoryExtraction('msg', 'resp', null);
    });
  });
});
