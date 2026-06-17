/** Client-side RAG prompt builder — mirrors backend buildRagPrompt. */
export function buildRagUserPrompt(userMessage, ragContext) {
  if (!ragContext?.trim()) return userMessage;

  const formatHints = {
    latex: 'Convert the document content to proper LaTeX with \\documentclass, sections, and formatting. Output complete LaTeX only — no placeholders.',
    summarize: 'Write a clear, accurate summary of the document content below.',
    translate: 'Translate the document content as requested by the user.',
    table: 'Extract data from the document and format it as a readable table.',
  };

  const lower = userMessage.toLowerCase();
  const formatKey = Object.keys(formatHints).find((k) => lower.includes(k));
  const formatInstruction = formatHints[formatKey]
    || 'Answer the user request using ONLY the document content below. Do NOT return placeholder code or TODO comments.';

  return `You are OWNAI. The user has uploaded documents.
${formatInstruction}

===== DOCUMENT CONTENT =====
${ragContext}
===========================

USER REQUEST: ${userMessage}`;
}

export function buildRagSystemMessage(ragContext) {
  if (!ragContext?.trim()) {
    return 'You are OWNAI. Answer directly. Never return placeholder code with TODO comments.';
  }
  return 'You are OWNAI. Use the document content in the user message. Never return placeholder templates or TODO comments. For LaTeX requests, output real LaTeX from the document.';
}
