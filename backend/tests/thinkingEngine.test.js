import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  THINKING_MODES,
  detectBestMode,
  resolveThinkingMode,
  selectReasoningMode,
  buildReasoningSystemPrompt,
  buildPromptForMode,
  buildCOTPrompt,
  buildTOTPrompt,
  wrapUserPromptForMode,
  parseConfidenceFromOutput,
  parseThinkingResponse,
  normalizeThinkingOutput,
  splitThinkingAndAnswer,
  buildThinkingEngineRules,
  shouldUseAnthropicExtendedThinking,
  modeShowsScratchpad,
} from '../src/ai/thinkingEngine.js';

describe('ai/thinkingEngine — PART A modes', () => {
  it('exports all 8 thinking modes', () => {
    assert.equal(Object.keys(THINKING_MODES).length, 8);
    assert.equal(THINKING_MODES.COT, 'chain_of_thought');
    assert.equal(THINKING_MODES.SOCRATIC, 'socratic');
    assert.equal(THINKING_MODES.DEBATE, 'debate');
  });

  it('detectBestMode picks COT for proof/derive prompts', () => {
    const result = detectBestMode('Prove the ME bound step by step');
    assert.equal(result.mode, THINKING_MODES.COT);
    assert.ok(result.confidence >= 80);
    assert.match(result.reason, /step/i);
  });

  it('detectBestMode picks TOT for decision questions', () => {
    const result = detectBestMode('Which option is the best way to implement LOA?');
    assert.equal(result.mode, THINKING_MODES.TOT);
  });

  it('detectBestMode picks REACT for search tasks', () => {
    const result = detectBestMode('Find the latest IEEE papers on VVC');
    assert.equal(result.mode, THINKING_MODES.REACT);
  });

  it('detectBestMode picks SELF_REFINE for critique tasks', () => {
    const result = detectBestMode('Improve my LaTeX abstract and critique it');
    assert.equal(result.mode, THINKING_MODES.SELF_REFINE);
  });

  it('detectBestMode picks EXTENDED for research complexity', () => {
    const result = detectBestMode('Novel PhD-level research problem');
    assert.equal(result.mode, THINKING_MODES.EXTENDED);
  });

  it('detectBestMode picks SOCRATIC for teaching prompts', () => {
    const result = detectBestMode('Explain how does approximate addition work?');
    assert.equal(result.mode, THINKING_MODES.SOCRATIC);
  });

  it('detectBestMode picks DEBATE for pros/cons', () => {
    const result = detectBestMode('Debate the pros and cons of LOA vs exact adders');
    assert.equal(result.mode, THINKING_MODES.DEBATE);
  });

  it('detectBestMode picks DIRECT for greetings', () => {
    const result = detectBestMode('Hello!');
    assert.equal(result.mode, THINKING_MODES.DIRECT);
  });

  it('detectBestMode uses EXTENDED when research context flag set', () => {
    const result = detectBestMode('Help with my simulation', { isResearch: true });
    assert.equal(result.mode, THINKING_MODES.EXTENDED);
  });

  it('resolveThinkingMode respects explicit mode override', () => {
    const result = resolveThinkingMode('anything', THINKING_MODES.DEBATE);
    assert.equal(result.mode, THINKING_MODES.DEBATE);
    assert.equal(result.autoDetected, false);
  });

  it('selectReasoningMode backward compat alias', () => {
    assert.equal(selectReasoningMode('Find papers', 'auto'), THINKING_MODES.REACT);
  });
  it('detectBestMode defaults to DIRECT for short queries', () => {
    const result = detectBestMode('Thanks!');
    assert.equal(result.mode, THINKING_MODES.DIRECT);
    assert.equal(result.confidence, 90);
  });

  it('detectBestMode defaults to COT for longer general queries', () => {
    const result = detectBestMode('Can you walk me through the full design of an approximate multiplier unit?');
    assert.equal(result.mode, THINKING_MODES.COT);
    assert.equal(result.confidence, 70);
  });
});

describe('ai/thinkingEngine — PART B JSON prompts', () => {
  it('buildCOTPrompt embeds problem and JSON schema', () => {
    const prompt = buildCOTPrompt('Derive ME', { wl: 8 });
    assert.match(prompt, /Derive ME/);
    assert.match(prompt, /"thinking_mode": "chain_of_thought"/);
    assert.match(prompt, /"wl":8/);
  });

  it('buildPromptForMode returns raw message for DIRECT', () => {
    assert.equal(buildPromptForMode(THINKING_MODES.DIRECT, 'Hello'), 'Hello');
  });

  it('buildPromptForMode uses TOT builder', () => {
    const prompt = buildPromptForMode(THINKING_MODES.TOT, 'Pick an architecture');
    assert.match(prompt, /Tree of Thoughts/);
    assert.match(prompt, /"branches"/);
  });

  it('wrapUserPromptForMode delegates to JSON builders', () => {
    const wrapped = wrapUserPromptForMode('Solve X', THINKING_MODES.REACT);
    assert.match(wrapped, /ReAct/);
    assert.match(wrapped, /"cycles"/);
  });
});

describe('ai/thinkingEngine — PART C response parser', () => {
  it('parseThinkingResponse parses valid JSON', () => {
    const raw = '```json\n{"thinking_mode":"chain_of_thought","final_answer":"42","confidence_overall":95,"steps":[]}\n```';
    const parsed = parseThinkingResponse(raw, THINKING_MODES.COT);
    assert.equal(parsed.final_answer, '42');
    assert.equal(parsed.confidence_overall, 95);
  });

  it('parseThinkingResponse falls back on invalid JSON', () => {
    const parsed = parseThinkingResponse('plain text answer', THINKING_MODES.COT);
    assert.equal(parsed.final_answer, 'plain text answer');
    assert.equal(parsed.confidence_overall, 50);
    assert.ok(parsed.parse_error);
  });

  it('normalizeThinkingOutput extracts thinking from structured JSON', () => {
    const raw = '{"thinking_mode":"extended","scratchpad":[{"type":"hypothesis","content":"test"}],"final_answer":"done","confidence_overall":88}';
    const normalized = normalizeThinkingOutput(raw, THINKING_MODES.EXTENDED);
    assert.equal(normalized.answer, 'done');
    assert.equal(normalized.confidence, 88);
    assert.match(normalized.thinking, /scratchpad/);
  });
});

describe('ai/thinkingEngine — legacy prose helpers', () => {
  it('buildReasoningSystemPrompt includes all mode rules', () => {
    assert.match(buildThinkingEngineRules(), /Socratic/i);
    assert.match(buildThinkingEngineRules(), /Debate/i);
    assert.match(buildReasoningSystemPrompt(THINKING_MODES.DEBATE), /Side A/i);
  });

  it('wrapUserPromptForMode adds Socratic wrapper', () => {
    const wrapped = wrapUserPromptForMode('Explain XOR', THINKING_MODES.SOCRATIC);
    assert.match(wrapped, /Socratic/i);
  });

  it('parseConfidenceFromOutput extracts trailing JSON', () => {
    const parsed = parseConfidenceFromOutput('Done.\n{"confidence":91,"confidence_reasoning":"verified"}');
    assert.equal(parsed.score, 91);
    assert.equal(parsed.cleanedText, 'Done.');
  });

  it('splitThinkingAndAnswer handles debate synthesis', () => {
    const text = '## Side A\npro\n## Side B\ncon\n## Synthesis\nbalanced';
    const split = splitThinkingAndAnswer(text);
    assert.equal(split.answer, 'balanced');
  });

  it('shouldUseAnthropicExtendedThinking for extended and COT', () => {
    assert.equal(shouldUseAnthropicExtendedThinking(THINKING_MODES.EXTENDED, true), true);
    assert.equal(shouldUseAnthropicExtendedThinking(THINKING_MODES.DIRECT, true), false);
  });

  it('modeShowsScratchpad false only for DIRECT', () => {
    assert.equal(modeShowsScratchpad(THINKING_MODES.DIRECT), false);
    assert.equal(modeShowsScratchpad(THINKING_MODES.COT), true);
  });
});
