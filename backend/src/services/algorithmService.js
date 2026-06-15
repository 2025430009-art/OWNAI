import { ALGORITHMS, getAlgorithm } from '../data/algorithms.js';

const INTENT_RULES = [
  { intent: 'coding', pattern: /\b(code|bug|debug|function|api|react|javascript|python|sql|error|compile|typescript|class|import)\b/i },
  { intent: 'math', pattern: /\b(calculate|equation|integral|derivative|matrix|proof|solve|algebra|geometry|\d+\s*[\+\-\*\/]\s*\d+)\b/i },
  { intent: 'planning', pattern: /\b(plan|roadmap|steps|strategy|timeline|checklist|how do i start|approach)\b/i },
  { intent: 'creative', pattern: /\b(write|story|poem|caption|creative|draft|brainstorm|slogan)\b/i },
  { intent: 'reasoning', pattern: /\b(why|explain|analyze|compare|pros and cons|difference between|how does)\b/i },
  { intent: 'factual', pattern: /\b(what is|who is|when|where|define|meaning of|list)\b/i },
];

const INTENT_GUIDANCE = {
  coding: [
    'Return clean, runnable code in a fenced block when code is requested.',
    'Mention edge cases briefly after the code.',
  ],
  math: [
    'Show key steps clearly.',
    'State assumptions and give the final answer explicitly.',
  ],
  planning: [
    'Use numbered steps with priorities.',
    'Keep actions concrete and achievable.',
  ],
  creative: [
    'Deliver one polished draft.',
    'Match tone to the user request.',
  ],
  reasoning: [
    'Explain cause and effect.',
    'Separate facts from interpretation.',
  ],
  factual: [
    'Answer directly in the first sentence.',
    'Add only essential supporting detail.',
  ],
  conversation: [
    'Be friendly and concise.',
    'Ask a clarifying question only if the prompt is ambiguous.',
  ],
};

export function listAlgorithms() {
  return ALGORITHMS;
}

export function detectIntent(prompt) {
  for (const rule of INTENT_RULES) {
    if (rule.pattern.test(prompt)) return rule.intent;
  }
  return 'conversation';
}

function buildUniversalPrompt(prompt, intent, algorithm) {
  const guidance = INTENT_GUIDANCE[intent] || INTENT_GUIDANCE.conversation;
  return [
    `[OWNAI-UARR/${algorithm.id}]`,
    `Algorithm: ${algorithm.name} v${algorithm.version}`,
    `Detected intent: ${intent}`,
    '',
    'Pipeline:',
    '1. Understand the user goal and constraints.',
    '2. Analyze what evidence or logic is needed.',
    '3. Respond with the best format for this intent.',
    '4. Refine for clarity — no filler, no repetition.',
    '',
    'Intent rules:',
    ...guidance.map((line, i) => `${i + 1}. ${line}`),
    '',
    'User question:',
    prompt.trim(),
  ].join('\n');
}

function buildPrecisePrompt(prompt, intent) {
  return [
    '[OWNAI-PRECISE]',
    'Give a direct, factual answer. If uncertain, say what is unknown.',
    `Context type: ${intent}`,
    '',
    'Question:',
    prompt.trim(),
  ].join('\n');
}

export function applyAlgorithm(algorithmId, userPrompt) {
  const algorithm = algorithmId ? getAlgorithm(algorithmId) : null;
  if (!algorithm) {
    return {
      prompt: userPrompt,
      meta: { algorithm_id: null, intent: null, strategy: 'direct' },
      temperature: null,
    };
  }

  const intent = detectIntent(userPrompt);
  let prompt = userPrompt;

  if (algorithm.id === 'ownai-universal') {
    prompt = buildUniversalPrompt(userPrompt, intent, algorithm);
  } else if (algorithm.id === 'ownai-precise') {
    prompt = buildPrecisePrompt(userPrompt, intent);
  }

  return {
    prompt,
    meta: {
      algorithm_id: algorithm.id,
      algorithm_name: algorithm.name,
      intent,
      strategy: `${algorithm.id}:${intent}`,
      pipeline: 'UARR',
    },
    temperature: algorithm.temperature,
  };
}

export function listAIEngines() {
  const models = [
    {
      key: 'default',
      name: 'Llama 3.2 1B Instruct Q4',
      type: 'model',
      description: 'Direct local inference — fast, no prompt shaping.',
      algorithm_id: null,
    },
  ];

  const algorithms = ALGORITHMS.map((a) => ({
    key: a.id,
    name: a.name,
    type: 'algorithm',
    description: a.description,
    tagline: a.tagline,
    algorithm_id: a.id,
    temperature: a.temperature,
  }));

  return [...models, ...algorithms];
}
