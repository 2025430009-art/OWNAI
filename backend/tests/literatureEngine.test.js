import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildLiteratureSearchPrompt,
  buildGapScorePrompt,
  parseLiteratureResponse,
  buildGapMatrixTable,
  LiteratureEngineError,
} from '../src/research/literatureEngine.js';
import {
  buildMathDerivationPrompt,
  buildValidationPrompt,
  buildCodeGenPrompt,
  MathEngineError,
} from '../src/research/mathEngine.js';

function sampleLiteratureJson(paperCount = 8) {
  const dimensions = ['Adder type', 'Multiplier', 'VVC support'];
  const papers = Array.from({ length: paperCount }, (_, i) => ({
    title: `Paper ${i + 1}`,
    authors: [`Author ${i + 1}`],
    journal: 'IEEE TVLSI',
    year: 2020 + i,
    doi_guess: `10.1109/test.${i}`,
    key_contribution: 'Contribution',
    limitation_gap: 'Gap',
    category: 'adder',
    citation_key: `R${i + 1}`,
  }));

  const gap_matrix = [];
  for (const p of papers) {
    for (const d of dimensions) {
      gap_matrix.push({
        citation_key: p.citation_key,
        dimension: d,
        value: 'partial',
        is_gap: d === 'VVC support',
        gap_score: 0.5,
      });
    }
  }

  return JSON.stringify({
    papers,
    dimensions,
    gap_matrix,
    proposed_contribution: {
      title_extension: 'Novel extension',
      novel_idea: 'Combine LOA and BAM',
      new_formula: 'E <= M * delta',
      expected_improvement: '0.1% BD-rate',
      supersedes: ['R1', 'R2'],
    },
  });
}

describe('literatureEngine', () => {
  it('buildLiteratureSearchPrompt includes domain and schema', () => {
    const prompt = buildLiteratureSearchPrompt('vlsi', 'LOA BAM', []);
    assert.match(prompt, /vlsi/i);
    assert.match(prompt, /LOA BAM/);
    assert.match(prompt, /gap_matrix/);
    assert.match(prompt, /proposed_contribution/);
  });

  it('buildLiteratureSearchPrompt excludes existing papers instruction', () => {
    const prompt = buildLiteratureSearchPrompt('vlsi', 'LOA', [
      { title: 'Existing', authors: ['A'], journal: 'IEEE', year: 2019 },
    ]);
    assert.match(prompt, /do NOT repeat/i);
    assert.match(prompt, /Existing/);
  });

  it('parseLiteratureResponse validates complete matrix', () => {
    const parsed = parseLiteratureResponse(sampleLiteratureJson(8));
    assert.equal(parsed.papers.length, 8);
    assert.equal(parsed.dimensions.length, 3);
    assert.equal(parsed.gap_cells.length, 24);
    assert.ok(parsed.contribution.novel_idea);
  });

  it('parseLiteratureResponse rejects incomplete matrix', () => {
    const bad = JSON.parse(sampleLiteratureJson(8));
    bad.gap_matrix.pop();
    assert.throws(
      () => parseLiteratureResponse(JSON.stringify(bad)),
      LiteratureEngineError,
    );
  });

  it('buildGapMatrixTable renders frontend structure', () => {
    const parsed = parseLiteratureResponse(sampleLiteratureJson(5));
    const table = buildGapMatrixTable(parsed.papers, parsed.dimensions, parsed.gap_cells);
    assert.equal(table.headers[0], 'Paper');
    assert.equal(table.rows.length, 5);
    assert.ok(table.total_gaps >= 0);
    assert.ok(table.recommended_direction.length > 0);
  });

  it('buildGapScorePrompt requires papers and dimensions', () => {
    assert.throws(() => buildGapScorePrompt([], ['a']), LiteratureEngineError);
  });
});

describe('mathEngine', () => {
  it('buildMathDerivationPrompt for LOA includes parameters', () => {
    const prompt = buildMathDerivationPrompt('LOA', { WL: 16, nLPL: 4 });
    assert.match(prompt, /WL=16/);
    assert.match(prompt, /nLPL=4/);
    assert.match(prompt, /"derivations"/);
  });

  it('buildValidationPrompt includes simulation data', () => {
    const prompt = buildValidationPrompt(
      { metric: 'PE', formula_latex: 'E=2^n' },
      { PE: 0.05 },
    );
    assert.match(prompt, /agreement_percent/);
    assert.match(prompt, /0.05/);
  });

  it('buildCodeGenPrompt includes tool rules', () => {
    const prompt = buildCodeGenPrompt('verilog', 'testbench', { WL: 16 }, { title: 'Test' });
    assert.match(prompt, /synthesisable Verilog/i);
    assert.match(prompt, /Test/);
  });

  it('buildCodeGenPrompt rejects unknown tool', () => {
    assert.throws(() => buildCodeGenPrompt('rust', 'sweep', {}), MathEngineError);
  });
});
