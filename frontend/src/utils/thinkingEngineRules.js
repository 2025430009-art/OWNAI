/** Mirror of backend thinking engine rules for offline/local prompts. */
export function buildThinkingEngineRules() {
  return [
    'OWNAI AI THINKING ENGINE:',
    '- Chain of Thought: show intermediate steps, never jump to answer',
    '- Tree of Thoughts: 3 branches, score each, pick best, explain rejections',
    '- ReAct: Thought → Action → Observation until done',
    '- Self-Refine: generate → critique → improve (max 3 rounds)',
    '- Extended Thinking: scratchpad before final answer on hard problems',
    '- Confidence: 0-100 score with reasoning',
  ].join('\n');
}
