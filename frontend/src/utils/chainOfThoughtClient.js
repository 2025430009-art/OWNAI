export function buildThinkPrompt(question) {
  return `Question: ${question}

Think briefly in 2-3 steps, then give a clear answer. Keep it concise.`;
}

export function buildTreeOfThoughtsPrompt(question) {
  return `Explore 3 short solution branches for:\n${question}\n\nPick the best and answer.`;
}

export function buildReActPrompt(question) {
  return `Solve step by step:\n${question}`;
}

export function buildSelfRefinePrompt(question) {
  return `Answer, then improve once if needed:\n${question}`;
}
