import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RESEARCH_KEYWORDS, messageHasResearchKeywords } from '../src/research/researchKeywords.js';
import { enrichWithResearchContext } from '../src/research/researchChatContext.js';

describe('researchKeywords', () => {
  it('includes expanded IEEE/VLSI keyword set', () => {
    assert.ok(RESEARCH_KEYWORDS.includes('PSNR'));
    assert.ok(RESEARCH_KEYWORDS.includes('testbench'));
    assert.ok(RESEARCH_KEYWORDS.includes('gate count'));
  });

  it('messageHasResearchKeywords is case-insensitive', () => {
    assert.equal(messageHasResearchKeywords('Help with ieee paper proof'), true);
    assert.equal(messageHasResearchKeywords('weather forecast'), false);
  });
});

describe('researchChatContext', () => {
  it('enrichWithResearchContext returns null without keywords', async () => {
    const result = await enrichWithResearchContext(
      { user: { id: 1 } },
      'What is the weather today?',
    );
    assert.equal(result, null);
  });

  it('enrichWithResearchContext returns null without authenticated user', async () => {
    const result = await enrichWithResearchContext(
      { user: null },
      'Derive a theorem for VLSI adder',
    );
    assert.equal(result, null);
  });
});
