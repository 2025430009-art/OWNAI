/**
 * Client-side helpers for OWNAI thinking engine SSE streams.
 */

function mergeThinkingResult(existing, incoming) {
  if (!incoming) return existing;
  if (!existing) return incoming;
  return {
    ...existing,
    ...incoming,
    cycles: incoming.cycles || existing.cycles,
    iterations: incoming.iterations || existing.iterations,
    steps: incoming.steps || existing.steps,
    branches: incoming.branches || existing.branches,
    scratchpad: incoming.scratchpad || existing.scratchpad,
  };
}

/**
 * Consume thinking-engine SSE from /api/v1/generate.
 * @param {Response} response
 * @param {{ onText?: Function, onThinking?: Function, onConfidence?: Function, onMeta?: Function, onThinkingResult?: Function }} handlers
 * @returns {Promise<{ text: string, thinking: string, confidence: object|null, meta: object, thinkingResult: object|null }>}
 */
export async function consumeThinkingSse(response, handlers = {}) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  let thinking = '';
  let confidence = null;
  let meta = {};
  let thinkingResult = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    let lineBreak = buffer.indexOf('\n');

    while (lineBreak >= 0) {
      const line = buffer.slice(0, lineBreak).trim();
      buffer = buffer.slice(lineBreak + 1);
      lineBreak = buffer.indexOf('\n');

      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6);
      if (payload === '[DONE]') continue;

      let event;
      try {
        event = JSON.parse(payload);
      } catch {
        continue;
      }

      if (event.token && !event.type) {
        text += event.token;
        handlers.onText?.(text, event.token);
        continue;
      }

      switch (event.type) {
        case 'text':
          text += event.token || '';
          handlers.onText?.(text, event.token);
          break;
        case 'thinking':
          thinking += event.token || '';
          handlers.onThinking?.(thinking, event.token);
          break;
        case 'text_replace':
          text = event.text || text;
          handlers.onText?.(text, '');
          break;
        case 'thinking_replace':
          thinking = event.text || thinking;
          handlers.onThinking?.(thinking, '');
          break;
        case 'confidence':
          confidence = { score: event.score, reasoning: event.reasoning };
          handlers.onConfidence?.(confidence);
          break;
        case 'meta':
          meta = { ...meta, ...event };
          if (event.reasoning_mode && !thinkingResult) {
            thinkingResult = { thinking_mode: event.reasoning_mode };
          }
          handlers.onMeta?.(event);
          break;
        case 'react_cycle': {
          const base = thinkingResult || { thinking_mode: 'react', cycles: [] };
          const cycles = [...(base.cycles || [])];
          const idx = cycles.findIndex((c) => c.cycle === event.cycle?.cycle);
          if (idx >= 0) cycles[idx] = event.cycle;
          else cycles.push(event.cycle);
          thinkingResult = { ...base, thinking_mode: 'react', cycles };
          handlers.onThinkingResult?.(thinkingResult);
          break;
        }
        case 'refine_iteration': {
          const base = thinkingResult || { thinking_mode: 'self_refine', iterations: [] };
          const iterations = [...(base.iterations || [])];
          const iteration = event.iteration;
          const idx = iterations.findIndex((it) => it.iteration === iteration?.iteration);
          if (idx >= 0) iterations[idx] = iteration;
          else iterations.push(iteration);
          thinkingResult = { ...base, thinking_mode: 'self_refine', iterations };
          handlers.onThinkingResult?.(thinkingResult);
          break;
        }
        case 'result': {
          const parsed = event.parsed || {};
          thinkingResult = mergeThinkingResult(thinkingResult, {
            ...parsed,
            thinking_mode: event.mode || parsed.thinking_mode || meta.reasoning_mode,
            final_answer: event.final_answer || parsed.final_answer || text,
            confidence_overall: event.confidence ?? parsed.confidence_overall,
          });
          if (event.confidence != null) {
            confidence = {
              score: event.confidence,
              reasoning: confidence?.reasoning,
              detail: event.confidence_detail || confidence?.detail,
            };
            handlers.onConfidence?.(confidence);
          }
          if (event.thinking_scratchpad) {
            thinking = event.thinking_scratchpad;
            handlers.onThinking?.(thinking, '');
          }
          handlers.onThinkingResult?.(thinkingResult);
          break;
        }
        default:
          break;
      }
    }
  }

  if (thinkingResult && !thinkingResult.final_answer && text) {
    thinkingResult = { ...thinkingResult, final_answer: text };
  }

  if (!thinkingResult && thinking && meta.reasoning_mode && meta.reasoning_mode !== 'direct') {
    thinkingResult = {
      thinking_mode: meta.reasoning_mode,
      confidence_overall: confidence?.score,
      scratchpad: [{ type: 'exploration', content: thinking }],
      final_answer: text,
    };
  }

  return { text, thinking, confidence, meta, thinkingResult };
}

export { buildThinkPrompt } from './chainOfThoughtClient.js';
