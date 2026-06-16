import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildResearchNamespace,
  buildPaperDocument,
  buildAugmentedPrompt,
  containsResearchKeywords,
  RESEARCH_KEYWORDS,
} from '../src/research/ragIntegration.js';

describe('ragIntegration', () => {
  it('buildResearchNamespace uses research:user:project format', () => {
    assert.equal(buildResearchNamespace(42, 'proj-uuid'), 'research:42:proj-uuid');
  });

  it('containsResearchKeywords detects research-related terms', () => {
    assert.equal(containsResearchKeywords('Help me derive a theorem for VLSI'), true);
    assert.equal(containsResearchKeywords('What is the weather today?'), false);
    assert.equal(containsResearchKeywords('BD-rate comparison for IEEE paper'), true);
  });

  it('exports expected keyword list', () => {
    assert.ok(RESEARCH_KEYWORDS.includes('MATLAB'));
    assert.ok(RESEARCH_KEYWORDS.includes('Verilog'));
  });

  it('buildPaperDocument includes metadata and metrics', () => {
    const text = buildPaperDocument({
      id: 'abc-123',
      title: 'LOA Adder Survey',
      authors: ['Mahdiani', 'Ahmadi'],
      journal: 'IEEE TVLSI',
      year: 2010,
      doi: '10.1109/tvlsi.2010.1',
      key_contribution: 'Bio-inspired approximate adder',
      limitation_gap: 'No VVC integration',
      category: 'adder',
      metrics: { PE: 0.42, ME: -0.25 },
    });

    assert.match(text, /LOA Adder Survey/);
    assert.match(text, /Mahdiani, Ahmadi/);
    assert.match(text, /Bio-inspired approximate adder/);
    assert.match(text, /No VVC integration/);
    assert.match(text, /PE: 0.42/);
    assert.match(text, /ME: -0.25/);
  });

  it('buildAugmentedPrompt returns base prompt when no RAG chunks exist', async () => {
    const base = 'Derive PE for LOA adder';
    const result = await buildAugmentedPrompt(base, 999999, '00000000-0000-4000-8000-000000000001');
    assert.equal(result, base);
  });
});
