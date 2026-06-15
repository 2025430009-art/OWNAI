export function buildThinkPrompt(question) {
  return `Question: ${question}

Before answering, think through this carefully:
1. What exactly is being asked?
2. What do I know about this topic?
3. What are the key points to address?
4. What would be the clearest explanation?

Now provide a thorough, accurate answer:`;
}
