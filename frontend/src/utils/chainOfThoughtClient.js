import { buildThinkingEngineRules } from './thinkingEngineRules.js';

export function buildThinkPrompt(question) {
  return `${buildThinkingEngineRules()}

Question: ${question}

Before answering, think through this carefully:
1. What exactly is being asked?
2. What do I know about this topic?
3. What are the key points to address?
4. What would be the clearest explanation?

Show numbered intermediate steps. Never jump directly to the final answer.
End with: {"confidence":0-100,"confidence_reasoning":"..."}

Now provide a thorough, accurate answer:`;
}

export function buildTreeOfThoughtsPrompt(question) {
  return `Explore 3 distinct solution branches for:
${question}

Score each branch 0-100. Pick the best and explain why the others were rejected.
End with confidence JSON.`;
}

export function buildReActPrompt(question) {
  return `Solve using ReAct cycles (Thought → Action → Observation):
${question}

End with Final Answer and confidence JSON.`;
}

export function buildSelfRefinePrompt(question) {
  return `Draft, critique, and refine up to 3 times:
${question}

Label each round. End with confidence JSON.`;
}
