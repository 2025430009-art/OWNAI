import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getTemplate,
  listTemplates,
  buildFullCodePrompt,
  buildParserPrompt,
  buildProjectContext,
  getPipelineOrder,
  CodeEngineError,
  MATLAB_TEMPLATES,
  PYTHON_TEMPLATES,
  VERILOG_TEMPLATES,
  LATEX_TEMPLATES,
} from '../src/research/codeEngine.js';

describe('codeEngine', () => {
  it('getTemplate returns known templates', () => {
    assert.ok(getTemplate('matlab', 'loa_adder'));
    assert.ok(getTemplate('python', 'verification_suite'));
    assert.ok(getTemplate('verilog', 'sau_loa'));
    assert.ok(getTemplate('latex', 'full_paper'));
    assert.equal(getTemplate('matlab', 'unknown'), null);
    assert.equal(getTemplate('rust', 'loa_adder'), null);
  });

  it('listTemplates covers all four tools', () => {
    const templates = listTemplates();
    const tools = new Set(templates.map((t) => t.tool));
    assert.deepEqual([...tools].sort(), ['latex', 'matlab', 'python', 'verilog']);
    assert.equal(Object.keys(MATLAB_TEMPLATES).length, 4);
    assert.equal(Object.keys(PYTHON_TEMPLATES).length, 1);
    assert.equal(Object.keys(VERILOG_TEMPLATES).length, 3);
    assert.equal(Object.keys(LATEX_TEMPLATES).length, 1);
  });

  it('buildFullCodePrompt embeds project context and template', () => {
    const prompt = buildFullCodePrompt('matlab', 'loa_adder', {
      title: 'LOA-VVC Study',
      domain: 'approximate_computing',
      parameters: { WL: 8, LPL: 3 },
      derivations: [{ metric: 'ME', formula_latex: '-0.25' }],
    });
    assert.match(prompt, /LOA-VVC Study/);
    assert.match(prompt, /loa_add\.m/);
    assert.match(prompt, /QUALITY RULES/);
    assert.match(prompt, /ME=-0.25/);
    assert.match(prompt, /"WL":8/);
  });

  it('buildFullCodePrompt throws for unknown template', () => {
    assert.throws(
      () => buildFullCodePrompt('matlab', 'nonexistent', {}),
      CodeEngineError,
    );
  });

  it('buildParserPrompt includes code and review checklist', () => {
    const prompt = buildParserPrompt('verilog', 'module loa_adder; endmodule');
    assert.match(prompt, /verilog/i);
    assert.match(prompt, /loa_adder/);
    assert.match(prompt, /CODE REVIEW: PASS/);
  });

  it('buildParserPrompt rejects empty code', () => {
    assert.throws(() => buildParserPrompt('python', ''), CodeEngineError);
  });

  it('buildProjectContext fills defaults', () => {
    const ctx = buildProjectContext({ title: 'Test' });
    assert.equal(ctx.title, 'Test');
    assert.equal(ctx.domain, 'approximate_computing');
    assert.deepEqual(ctx.parameters, {});
  });

  it('getPipelineOrder returns phased cross-tool sequence', () => {
    const order = getPipelineOrder();
    assert.ok(order.length >= 8);
    assert.ok(order.some((s) => s.tool === 'matlab' && s.type === 'loa_adder'));
    assert.ok(order.some((s) => s.tool === 'latex' && s.type === 'full_paper'));
  });
});
