const DIRECT_MODE = 'direct';

function tryParseJson(text) {
  if (!text?.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function isStructuredThinking(value) {
  if (!value || typeof value !== 'object') return false;
  return Boolean(
    value.thinking_mode
    || value.steps
    || value.branches
    || value.cycles
    || value.iterations
    || value.scratchpad
    || value.side_a
    || value.clarifying_questions,
  );
}

function normalizeConfidence(parsed, confidence) {
  if (parsed.confidence_overall != null) return parsed.confidence_overall;
  if (confidence?.score != null) return confidence.score;
  return parsed.confidence ?? 70;
}

/**
 * Normalize thinking payload from SSE, stored message fields, or raw JSON string.
 */
export function parseThinkingResult({
  thinking = '',
  thinkingResult = null,
  meta = {},
  confidence = null,
  content = '',
} = {}) {
  let parsed = thinkingResult;

  if (!parsed && thinking) {
    parsed = tryParseJson(thinking);
  }

  if (parsed && !isStructuredThinking(parsed) && parsed.cycles) {
    parsed = { thinking_mode: 'react', ...parsed };
  }

  const mode = parsed?.thinking_mode || meta?.reasoning_mode || null;

  if (!parsed) {
    if (!mode || mode === DIRECT_MODE) return null;
    if (thinking?.trim()) {
      return {
        thinking_mode: mode,
        confidence_overall: confidence?.score ?? 70,
        final_answer: content,
        scratchpad: [{ type: 'exploration', content: thinking }],
      };
    }
    return null;
  }

  return {
    ...parsed,
    thinking_mode: mode || parsed.thinking_mode || 'extended',
    confidence_overall: normalizeConfidence(parsed, confidence),
    final_answer: parsed.final_answer || content || '',
  };
}

export function shouldShowThinkingVisualizer(thinkingResult, reasoningMode) {
  const mode = thinkingResult?.thinking_mode || reasoningMode;
  if (!mode || mode === DIRECT_MODE) return false;
  return true;
}
