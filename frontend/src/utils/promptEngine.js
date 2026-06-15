/**
 * Offline prompt engine — no API keys, no network. Powers STATIC mode on GitHub Pages.
 */

const TEMPLATES = {
  greeting: () =>
    "Hello! I'm **OWNAI v2** running in offline mode. I can help draft emails, outline code, summarize text, and answer general questions. What would you like to work on?",

  email: (prompt) => {
    const topic = prompt.replace(/help me write|write|draft|email|about/gi, '').trim() || 'your topic';
    return `Here's a professional email draft about **${topic}**:

**Subject:** Regarding ${topic}

Dear [Recipient Name],

I hope this message finds you well. I am writing to discuss ${topic}.

[Add 2–3 sentences with your main point, context, and any relevant details.]

Please let me know if you have any questions or if a brief call would be helpful.

Best regards,
[Your Name]`;

  },

  code: (prompt) => {
    const lang = /python/i.test(prompt) ? 'python'
      : /javascript|js|react/i.test(prompt) ? 'javascript'
      : /typescript|ts/i.test(prompt) ? 'typescript'
      : 'javascript';
    return `Here's a **${lang}** starter based on your request:

\`\`\`${lang}
// ${prompt.slice(0, 80)}
function solve(input) {
  // TODO: implement core logic
  return input;
}

export default solve;
\`\`\`

**Next steps:** Add error handling, tests, and edge cases. Connect the OWNAI backend or Ollama locally for full AI-generated code.`;
  },

  summarize: (prompt) => {
    const text = prompt.replace(/summarize|summary|tldr/gi, '').trim();
    return text
      ? `**Summary outline** for your text:

1. **Main idea** — Identify the central claim or purpose.
2. **Key points** — List 3–5 supporting details from the source.
3. **Conclusion** — State the outcome or recommendation.

*Paste longer text with the backend connected for a full AI summary.*`
      : 'Paste the text you want summarized, and I\'ll produce a concise overview.';
  },

  explain: (prompt) =>
    `**Explanation**

${prompt.replace(/^(explain|what is|what are|how does|how do)\s*/i, '')} — in simple terms:

This concept typically involves core principles, practical use cases, and trade-offs. In offline mode I provide structured guidance; connect **Ollama** or the **OWNAI backend** for deeper, context-aware answers.`,

  fallback: (prompt) =>
    `I understand you're asking about: **"${prompt.slice(0, 120)}${prompt.length > 120 ? '…' : ''}"**

I'm running in **offline mode** (no backend connected). I can still help with:
- Professional **emails**
- **Code** outlines
- **Summaries** and explanations
- General **Q&A**

Try: *"Help me write an email about…"* or *"Write a Python function to…"*

For full AI inference, run the backend locally or connect one in the dashboard.`,
};

function classifyPrompt(prompt) {
  const p = prompt.trim().toLowerCase();
  if (/^(hi|hello|hey|good\s+(morning|afternoon|evening)|greetings)\b/.test(p)) return 'greeting';
  if (/\b(email|e-mail|mail)\b/.test(p) || /write.*(letter|message)/.test(p)) return 'email';
  if (/\b(code|function|class|script|algorithm|implement|program)\b/.test(p) || /write.*(python|javascript|java|rust)/.test(p)) return 'code';
  if (/\b(summarize|summary|tldr|condense)\b/.test(p)) return 'summarize';
  if (/^(explain|what is|what are|how does|how do|why)\b/.test(p)) return 'explain';
  return 'fallback';
}

export function generatePromptResponse(prompt) {
  const kind = classifyPrompt(prompt);
  const fn = TEMPLATES[kind] || TEMPLATES.fallback;
  return fn(prompt);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Simulate streaming for a natural chat feel */
export async function* streamPromptResponse(prompt) {
  const text = generatePromptResponse(prompt);
  const chunks = text.match(/\S+\s*|\n/g) || [text];
  for (const chunk of chunks) {
    yield chunk;
    await sleep(12 + Math.random() * 20);
  }
}

export async function collectPromptResponse(prompt) {
  let out = '';
  for await (const token of streamPromptResponse(prompt)) {
    out += token;
  }
  return out;
}
