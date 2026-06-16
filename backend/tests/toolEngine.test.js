import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BUILTIN_TOOLS,
  parseReActStep,
  buildReActStepPrompt,
  buildUpdatedContext,
  executeTool,
  executeReActLoop,
  getToolDefinitions,
  resolveAvailableTools,
} from '../src/ai/toolEngine.js';

describe('toolEngine — builtin tools', () => {
  it('exports six builtin tools', () => {
    assert.equal(Object.keys(BUILTIN_TOOLS).length, 6);
    assert.ok(BUILTIN_TOOLS.calculator);
    assert.ok(BUILTIN_TOOLS.rag_search);
  });

  it('calculator evaluates safe expressions', async () => {
    const result = await BUILTIN_TOOLS.calculator.execute({ expression: '2+3*4' });
    assert.equal(result.result, '14');
  });

  it('calculator rejects invalid expressions', async () => {
    const result = await BUILTIN_TOOLS.calculator.execute({ expression: 'import os' });
    assert.ok(result.error);
  });

  it('code_runner blocks unsafe snippets', async () => {
    const result = await BUILTIN_TOOLS.code_runner.execute({
      code: "import os; os.system('rm -rf /')",
      language: 'python',
    });
    assert.match(result.error, /Unsafe code detected/i);
  });

  it('code_runner returns sandbox note for safe code', async () => {
    const result = await BUILTIN_TOOLS.code_runner.execute({
      code: 'print(42)',
      language: 'python',
    });
    assert.match(result.output, /Sandboxed execution/i);
  });

  it('knowledge_graph returns structured mock', async () => {
    const result = await BUILTIN_TOOLS.knowledge_graph.execute({ concept: 'LOA' });
    assert.equal(result.concept, 'LOA');
    assert.ok(Array.isArray(result.related));
  });
});

describe('toolEngine — ReAct helpers', () => {
  it('parseReActStep parses JSON step', () => {
    const raw = '{"thought":"Need math","action":{"tool":"calculator","input":{"expression":"2+2"}},"is_final":false}';
    const step = parseReActStep(raw);
    assert.equal(step.action.tool, 'calculator');
    assert.equal(step.is_final, false);
  });

  it('parseReActStep falls back when JSON missing', () => {
    const step = parseReActStep('done thinking');
    assert.equal(step.is_final, true);
    assert.equal(step.final_answer, 'done thinking');
  });

  it('buildReActStepPrompt includes prior cycles and tools', () => {
    const prompt = buildReActStepPrompt('Find papers', [
      {
        cycle: 1,
        thought: 'Search web',
        action: { tool: 'web_search', input: { query: 'VVC' } },
        observation: { results: ['hit'] },
      },
    ], Object.values(BUILTIN_TOOLS));

    assert.match(prompt, /Find papers/);
    assert.match(prompt, /Cycle 1/);
    assert.match(prompt, /web_search/);
  });

  it('buildUpdatedContext summarizes observations', () => {
    const updated = buildUpdatedContext('Question', [
      { thought: 'Tried calc', observation: { result: '4' } },
    ]);
    assert.match(updated, /Question/);
    assert.match(updated, /Tried calc/);
  });

  it('executeTool resolves builtin by name', async () => {
    const result = await executeTool('calculator', { expression: '5+5' }, null, []);
    assert.equal(result.result, '10');
  });

  it('resolveAvailableTools merges custom definitions with builtins', () => {
    const tools = resolveAvailableTools([{ name: 'web_search', description: 'custom' }]);
    assert.equal(tools.length, 6);
    assert.ok(tools.find((tool) => tool.name === 'web_search'));
  });

  it('getToolDefinitions strips execute functions', () => {
    const defs = getToolDefinitions([]);
    assert.ok(defs.every((tool) => !tool.execute));
    assert.ok(defs.every((tool) => tool.name && tool.description));
  });
});

describe('toolEngine — executeReActLoop', () => {
  it('runs cycles until final step', async () => {
    let callCount = 0;
    const mockCallAI = async () => {
      callCount += 1;
      if (callCount === 1) {
        return JSON.stringify({
          thought: 'Compute sum',
          action: { tool: 'calculator', input: { expression: '10+5' } },
          is_final: false,
        });
      }
      return JSON.stringify({
        thought: 'Got answer',
        action: { tool: 'none', input: {} },
        is_final: true,
        final_answer: 'The sum is 15',
      });
    };

    const result = await executeReActLoop(
      'What is 10+5?',
      { userId: 1 },
      [],
      6,
      { callAI: mockCallAI },
    );

    assert.equal(result.cycles.length, 2);
    assert.equal(result.final_answer, 'The sum is 15');
    assert.deepEqual(result.tools_used, ['calculator']);
    assert.ok(result.cycles[0].observation.result === '15');
  });

  it('handles unknown tools gracefully', async () => {
    const mockCallAI = async () => JSON.stringify({
      thought: 'Try missing tool',
      action: { tool: 'nonexistent_tool', input: {} },
      is_final: false,
    });

    const result = await executeReActLoop(
      'Test',
      {},
      [],
      1,
      { callAI: mockCallAI },
    );

    assert.match(result.cycles[0].observation.error, /Unknown tool/);
  });
});
