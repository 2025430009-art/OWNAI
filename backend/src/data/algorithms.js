export const ALGORITHMS = [
  {
    id: 'ownai-universal',
    name: 'OWNAI Universal Q&A',
    tagline: 'Answers every question type with adaptive reasoning',
    description:
      'Uses the OWNAI UARR pipeline (Understand → Analyze → Respond → Refine) to detect intent and shape responses for coding, math, facts, planning, and creative tasks.',
    version: '1.0',
    default: true,
    temperature: 0.65,
    intents: ['factual', 'coding', 'reasoning', 'math', 'planning', 'creative', 'conversation'],
  },
  {
    id: 'ownai-precise',
    name: 'OWNAI Precise',
    tagline: 'Short, factual, low-hallucination answers',
    description:
      'Optimized for definitions, comparisons, and direct Q&A with minimal speculation.',
    version: '1.0',
    default: false,
    temperature: 0.25,
    intents: ['factual', 'reasoning', 'math'],
  },
];

export function getAlgorithm(id) {
  return ALGORITHMS.find((a) => a.id === id) ?? null;
}

export function getDefaultAlgorithm() {
  return ALGORITHMS.find((a) => a.default) ?? ALGORITHMS[0];
}
