export const FALLBACK_ENGINES = [
  {
    key: 'default',
    name: 'Llama 3.2 1B Instruct Q4',
    type: 'model',
    description: 'Direct local inference',
    algorithm_id: null,
  },
  {
    key: 'ownai-universal',
    name: 'OWNAI Universal Q&A',
    type: 'algorithm',
    description: 'Adaptive answers for every question type',
    algorithm_id: 'ownai-universal',
  },
  {
    key: 'ownai-precise',
    name: 'OWNAI Precise',
    type: 'algorithm',
    description: 'Short factual answers',
    algorithm_id: 'ownai-precise',
  },
];

export function resolveEngine(engineKey, engines = FALLBACK_ENGINES) {
  const engine = engines.find((e) => e.key === engineKey);
  if (!engine) {
    return { model_key: 'default', algorithm_id: null };
  }
  if (engine.type === 'algorithm') {
    return { model_key: 'default', algorithm_id: engine.algorithm_id };
  }
  return { model_key: engine.key, algorithm_id: null };
}
