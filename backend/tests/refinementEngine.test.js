import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  extractJSON,
  extractDraft,
  parseCritique,
  buildCritiquePrompt,
  buildImprovementPrompt,
  selfRefineLoop,
  scoreResponseConfidence,
  detectKnowledgeGaps,
} from '../src/ai/refinementEngine.js';

describe('refinementEngine — helpers', () => {
  it('extractJSON pulls object from fenced response', () => {
    const raw = 'Here:\n```json\n{"score":88}\n```';
    assert.equal(extractJSON(raw), '{"score":88}');
  });

  it('extractDraft prefers JSON draft field', () => {
    const draft = extractDraft('{"draft":"Improved answer text"}');
    assert.equal(draft, 'Improved answer text');
  });

  it('extractDraft strips markdown answer headers', () => {
    const draft = extractDraft('## Answer\nFinal content');
    assert.equal(draft, 'Final content');
  });

  it('parseCritique parses valid JSON critique', () => {
    const critique = parseCritique(JSON.stringify({
      score: 82,
      weaknesses: ['Too brief'],
      missing: ['Examples'],
      improvement_priority: 'Add examples',
    }));
    assert.equal(critique.score, 82);
    assert.deepEqual(critique.weaknesses, ['Too brief']);
  });

  it('parseCritique falls back on invalid JSON', () => {
    const critique = parseCritique('not json');
    assert.equal(critique.score, 50);
    assert.ok(critique.parse_error);
  });

  it('buildImprovementPrompt includes critique details', () => {
    const prompt = buildImprovementPrompt('Q?', 'Draft', {
      score: 60,
      weaknesses: ['vague'],
      missing: ['data'],
    });
    assert.match(prompt, /Q\?/);
    assert.match(prompt, /vague/);
    assert.match(prompt, /60\/100/);
  });

  it('buildCritiquePrompt requests JSON schema', () => {
    assert.match(buildCritiquePrompt('Q', 'A'), /"score": 0-100/);
  });
});

describe('refinementEngine — selfRefineLoop', () => {
  it('runs iterations and picks best scoring draft', async () => {
    let callCount = 0;
    const mockCallAI = async (prompt) => {
      callCount += 1;
      if (prompt.includes('harsh but fair critic')) {
        const iteration = Math.ceil(callCount / 2);
        return JSON.stringify({
          score: iteration === 1 ? 55 : 92,
          weaknesses: iteration === 1 ? ['Incomplete'] : [],
          missing: [],
          improvement_priority: 'Add detail',
        });
      }
      if (callCount === 1) return 'Initial short answer';
      return 'Improved comprehensive answer with examples';
    };

    const result = await selfRefineLoop('Explain LOA', {}, 3, { callAI: mockCallAI });

    assert.ok(result.iterations.length >= 1);
    assert.equal(result.final_answer, 'Improved comprehensive answer with examples');
    assert.equal(result.confidence_overall, 92);
    assert.ok(result.score_progression.length >= 1);
  });

  it('stops early when score reaches 90', async () => {
    const mockCallAI = async (prompt) => {
      if (prompt.includes('harsh but fair critic')) {
        return JSON.stringify({ score: 95, weaknesses: [], missing: [] });
      }
      return 'Excellent answer on first try';
    };

    const result = await selfRefineLoop('Easy question', {}, 3, { callAI: mockCallAI });
    assert.equal(result.iterations.length, 1);
    assert.equal(result.confidence_overall, 95);
  });
});

describe('refinementEngine — confidence and gaps', () => {
  it('scoreResponseConfidence parses dimension scores', async () => {
    const mockCallAI = async () => JSON.stringify({
      dimensions: {
        factual_accuracy: { score: 90, reason: 'Solid' },
        completeness: { score: 80, reason: 'Mostly complete' },
      },
      overall: 85,
      should_caveat: false,
      caveat_text: '',
      high_uncertainty_areas: [],
    });

    const result = await scoreResponseConfidence('Q', 'A', {}, { callAI: mockCallAI });
    assert.equal(result.overall, 85);
    assert.equal(result.dimensions.factual_accuracy.score, 90);
    assert.equal(result.should_caveat, false);
  });

  it('scoreResponseConfidence falls back on parse failure', async () => {
    const result = await scoreResponseConfidence('Q', 'A', {}, {
      callAI: async () => 'not json',
    });
    assert.equal(result.overall, 70);
    assert.equal(result.should_caveat, true);
  });

  it('detectKnowledgeGaps returns structured gaps', async () => {
    const mockCallAI = async () => JSON.stringify({
      gaps: [{
        description: 'Latest benchmark numbers',
        severity: 'important',
        suggested_tool: 'web_search',
        search_query: 'VVC BD-rate 2024',
      }],
      can_answer_without_gaps: false,
      minimum_gaps_needed: ['Latest benchmark numbers'],
    });

    const result = await detectKnowledgeGaps('Compare codecs', 'Partial overview', {
      callAI: mockCallAI,
    });

    assert.equal(result.gaps.length, 1);
    assert.equal(result.can_answer_without_gaps, false);
  });

  it('detectKnowledgeGaps falls back safely', async () => {
    const result = await detectKnowledgeGaps('Q', 'A', {
      callAI: async () => 'broken',
    });
    assert.deepEqual(result.gaps, []);
    assert.equal(result.can_answer_without_gaps, true);
  });
});
