export const THINKING_MODE_OPTIONS = [
  {
    id: 'auto',
    label: 'Auto',
    apiMode: 'auto',
    tooltip: 'Server picks the best reasoning mode for your question',
  },
  {
    id: 'steps',
    label: 'Steps',
    apiMode: 'chain_of_thought',
    tooltip: 'Step-by-step chain of thought reasoning',
  },
  {
    id: 'explore',
    label: 'Explore',
    apiMode: 'tree_of_thoughts',
    tooltip: 'Explore multiple approaches and pick the best branch',
  },
  {
    id: 'tools',
    label: 'Tools',
    apiMode: 'react',
    tooltip: 'ReAct loop — reason, call tools, observe results',
  },
  {
    id: 'refine',
    label: 'Refine',
    apiMode: 'self_refine',
    tooltip: 'Draft, critique, and self-improve up to 3 times',
  },
  {
    id: 'deep',
    label: 'Deep',
    apiMode: 'extended',
    tooltip: 'Extended scratchpad thinking for hard problems',
  },
  {
    id: 'debate',
    label: 'Debate',
    apiMode: 'debate',
    tooltip: 'Argue both sides, then synthesize a balanced answer',
  },
];

export const MODE_LABELS = {
  auto: 'Auto-detect',
  direct: 'Direct answer',
  chain_of_thought: 'Step-by-step reasoning',
  tree_of_thoughts: 'Multi-branch exploration',
  react: 'Tool-augmented reasoning',
  self_refine: 'Self-improving answer',
  extended: 'Deep thinking',
  debate: 'Balanced debate analysis',
  socratic: 'Socratic method',
};

export function apiModeFromUiId(uiId) {
  const found = THINKING_MODE_OPTIONS.find((o) => o.id === uiId);
  return found?.apiMode || 'auto';
}

export function shouldUseThinkEndpoint(thinkingModeUi, hasAttachments) {
  if (hasAttachments) return false;
  return thinkingModeUi !== 'direct';
}
