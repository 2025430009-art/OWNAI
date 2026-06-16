/**
 * OWNAI Core AI Thinking Engine — modes, JSON prompts, and response parsing.
 */

export class ThinkingEngineError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ThinkingEngineError';
  }
}

// ---------------------------------------------------------------------------
// PART A: THINKING MODES
// ---------------------------------------------------------------------------

export const THINKING_MODES = {
  DIRECT: 'direct',
  COT: 'chain_of_thought',
  TOT: 'tree_of_thoughts',
  REACT: 'react',
  SELF_REFINE: 'self_refine',
  HUMAN_THINK: 'human_think',
  EXTENDED: 'extended',
  SOCRATIC: 'socratic',
  DEBATE: 'debate',
};

/** All selectable mode values (excluding auto). */
export const ALL_THINKING_MODES = Object.values(THINKING_MODES);

/** Legacy alias list used by API validation. */
export const REASONING_MODES = ['auto', ...ALL_THINKING_MODES];

const MODE_PATTERNS = [
  {
    regex: /\b(prove|derive|theorem)\b|step[\s.]by[\s.]step|mathematically/i,
    mode: THINKING_MODES.COT,
    confidence: 85,
    reason: 'Math/proof requires step decomposition',
  },
  {
    regex: /\b(best way|which option|should i choose)\b|\bcompare\b/i,
    mode: THINKING_MODES.TOT,
    confidence: 85,
    reason: 'Decision requires exploring alternatives',
  },
  {
    regex: /\b(search|find)\b|look up|\b(latest|current)\b|\bcheck\b/i,
    mode: THINKING_MODES.REACT,
    confidence: 85,
    reason: 'Task requires tool use + observation',
  },
  {
    regex: /\b(improve|better|review|critique)\b|fix my/i,
    mode: THINKING_MODES.SELF_REFINE,
    confidence: 85,
    reason: 'Output quality task benefits from self-critique',
  },
  {
    regex: /\b(complex|hard|difficult|phd|novel)\b|\bresearch\b/i,
    mode: THINKING_MODES.EXTENDED,
    confidence: 85,
    reason: 'Complex problem needs extended reasoning',
  },
  {
    regex: /\b(explain|understand|teach me)\b|\bwhat is\b|\bhow does\b/i,
    mode: THINKING_MODES.SOCRATIC,
    confidence: 85,
    reason: 'Teaching benefits from Socratic method',
  },
  {
    regex: /pros[\s.]cons|\b(advantages|disadvantages)\b|\bdebate\b|\bargue\b/i,
    mode: THINKING_MODES.DEBATE,
    confidence: 85,
    reason: 'Balanced analysis needs both sides',
  },
];

/**
 * Auto-detect the best thinking mode for a user message.
 * @param {string} userMessage
 * @param {object} [context]
 * @returns {{ mode: string, confidence: number, reason: string }}
 */
export function detectBestMode(userMessage, context = {}) {
  const msg = String(userMessage || '').trim();
  if (!msg) {
    return {
      mode: THINKING_MODES.DIRECT,
      confidence: 50,
      reason: 'Empty message — default to direct response',
    };
  }

  if (context.preferredMode && ALL_THINKING_MODES.includes(context.preferredMode)) {
    return {
      mode: context.preferredMode,
      confidence: 95,
      reason: 'Mode explicitly requested by caller',
    };
  }

  if (context.isResearch || context.hasResearchContext) {
    return {
      mode: THINKING_MODES.EXTENDED,
      confidence: 88,
      reason: 'Active research context — extended reasoning enabled',
    };
  }

  for (const pattern of MODE_PATTERNS) {
    if (pattern.regex.test(msg)) {
      return {
        mode: pattern.mode,
        confidence: pattern.confidence,
        reason: pattern.reason,
      };
    }
  }

  const wordCount = msg.split(/\s+/).filter(Boolean).length;
  if (wordCount < 8) {
    return {
      mode: THINKING_MODES.DIRECT,
      confidence: 90,
      reason: 'Simple query',
    };
  }

  return {
    mode: THINKING_MODES.COT,
    confidence: 70,
    reason: 'Default step-by-step reasoning',
  };
}

/**
 * Resolve final mode from API request (auto | explicit mode).
 * @param {string} userMessage
 * @param {string} [requestedMode='auto']
 * @param {object} [context]
 * @returns {{ mode: string, confidence: number, reason: string, autoDetected: boolean }}
 */
export function resolveThinkingMode(userMessage, requestedMode = 'auto', context = {}) {
  const normalized = String(requestedMode || 'auto').toLowerCase();

  if (normalized !== 'auto' && ALL_THINKING_MODES.includes(normalized)) {
    return {
      mode: normalized,
      confidence: 95,
      reason: 'Mode explicitly set in request',
      autoDetected: false,
    };
  }

  const detected = detectBestMode(userMessage, context);
  return { ...detected, autoDetected: true };
}

/** @deprecated Use resolveThinkingMode — kept for backward compatibility. */
export function selectReasoningMode(prompt, requestedMode = 'auto') {
  return resolveThinkingMode(prompt, requestedMode).mode;
}

// ---------------------------------------------------------------------------
// PART B: JSON PROMPT BUILDERS FOR EACH MODE
// ---------------------------------------------------------------------------

export function buildCOTPrompt(userMessage, context = {}) {
  return `You are an expert assistant. Think through this step by step.

PROBLEM: ${userMessage}

CONTEXT: ${JSON.stringify(context)}

Respond in this EXACT JSON format:
{
  "thinking_mode": "chain_of_thought",
  "problem_restatement": "Restate what is being asked in your own words",
  "steps": [
    {
      "step_number": 1,
      "title": "Short step name",
      "reasoning": "Full reasoning for this step",
      "result": "What this step produces",
      "confidence": 0-100
    }
  ],
  "final_answer": "Complete final answer",
  "confidence_overall": 0-100,
  "assumptions_made": ["assumption 1", "assumption 2"],
  "alternative_approaches": ["approach 1 if you had taken different path"]
}`;
}

export function buildTOTPrompt(userMessage, context = {}) {
  return `You are an expert using Tree of Thoughts reasoning.
For this problem, explore 3 different approaches/branches, score each, then choose the best.

PROBLEM: ${userMessage}
CONTEXT: ${JSON.stringify(context)}

Respond in EXACT JSON:
{
  "thinking_mode": "tree_of_thoughts",
  "problem_analysis": "What makes this problem hard or ambiguous",
  "branches": [
    {
      "branch_id": "A",
      "approach_name": "Name of this approach",
      "reasoning": "How this approach tackles the problem",
      "steps": ["step 1", "step 2", "step 3"],
      "pros": ["pro 1", "pro 2"],
      "cons": ["con 1", "con 2"],
      "score": 0-100,
      "score_reason": "Why this score"
    },
    { "branch_id": "B", "approach_name": "...", "reasoning": "...", "steps": [], "pros": [], "cons": [], "score": 0, "score_reason": "..." },
    { "branch_id": "C", "approach_name": "...", "reasoning": "...", "steps": [], "pros": [], "cons": [], "score": 0, "score_reason": "..." }
  ],
  "selected_branch": "A/B/C",
  "selection_reason": "Why this branch wins",
  "final_answer": "Answer using the selected branch",
  "confidence_overall": 0-100
}`;
}

export function buildReActPrompt(userMessage, context = {}, tools = []) {
  const toolList = tools.map((t) => `- ${t.name}: ${t.description}`).join('\n');
  return `You are an expert using ReAct (Reason + Act) framework.
Alternate between Thought, Action, and Observation until you reach the answer.

AVAILABLE TOOLS:
${toolList || '- web_search: search the internet\n- calculator: compute math\n- code_runner: execute code'}

PROBLEM: ${userMessage}
CONTEXT: ${JSON.stringify(context)}

Respond in EXACT JSON:
{
  "thinking_mode": "react",
  "cycles": [
    {
      "cycle": 1,
      "thought": "What I think about the current state",
      "action": { "tool": "tool_name", "input": "what to pass to tool" },
      "observation": "What the tool returned (or what I know)",
      "is_final": false
    }
  ],
  "final_thought": "Final synthesis of all observations",
  "final_answer": "Complete answer",
  "confidence_overall": 0-100,
  "tools_used": ["tool1", "tool2"]
}`;
}

export function buildSelfRefinePrompt(userMessage, context = {}) {
  return `You are an expert using Self-Refine reasoning.
Generate an initial response, critique it harshly, then improve it. Repeat 3 times.

PROBLEM: ${userMessage}
CONTEXT: ${JSON.stringify(context)}

Respond in EXACT JSON:
{
  "thinking_mode": "self_refine",
  "iterations": [
    {
      "iteration": 1,
      "draft": "Initial attempt at answering",
      "critique": {
        "weaknesses": ["weakness 1", "weakness 2"],
        "missing": ["what is missing"],
        "score": 0-100
      },
      "improvement_plan": "What to fix in next iteration"
    },
    { "iteration": 2, "draft": "...", "critique": { "weaknesses": [], "missing": [], "score": 0 }, "improvement_plan": "..." },
    { "iteration": 3, "draft": "...", "critique": { "weaknesses": [], "missing": [], "score": 0 }, "improvement_plan": "..." }
  ],
  "final_answer": "Best version after 3 refinements",
  "improvement_delta": "How much better final is vs iteration 1",
  "confidence_overall": 0-100
}`;
}

export function buildHumanThinkPrompt(userMessage, context = {}) {
  return `You are OWNAI thinking like a careful human expert — not a template bot.
Use an inner monologue: notice assumptions, doubt yourself, backtrack when needed, then improve.

PROBLEM: ${userMessage}
CONTEXT: ${JSON.stringify(context)}

Think in this human-like sequence:
1. Inner monologue — what you first notice, feel uncertain about, and want to clarify
2. First draft answer
3. Honest self-critique (weaknesses, missing pieces, tone issues)
4. Improved answer after reflection
5. Final polished answer a human would be proud to share

Respond in EXACT JSON:
{
  "thinking_mode": "human_think",
  "inner_monologue": ["first thought", "doubt or question", "reframe"],
  "iterations": [
    {
      "iteration": 1,
      "draft": "Initial human-style attempt",
      "critique": {
        "weaknesses": ["..."],
        "missing": ["..."],
        "score": 0-100
      },
      "improvement_plan": "What to fix next"
    }
  ],
  "final_answer": "Best human-quality answer after reflection",
  "improvement_delta": "How the final answer improved",
  "confidence_overall": 0-100,
  "remaining_uncertainty": "What is still unclear"
}`;
}

export function buildExtendedThinkingPrompt(userMessage, context = {}) {
  return `You are an expert tackling a genuinely hard problem.
Use your full scratchpad: explore, doubt yourself, backtrack, try again.

PROBLEM: ${userMessage}
CONTEXT: ${JSON.stringify(context)}

Respond in EXACT JSON:
{
  "thinking_mode": "extended",
  "scratchpad": [
    { "type": "hypothesis", "content": "..." },
    { "type": "exploration", "content": "..." },
    { "type": "dead_end", "content": "...", "reason_abandoned": "..." },
    { "type": "breakthrough", "content": "..." },
    { "type": "verification", "content": "..." }
  ],
  "key_insight": "The single most important realization",
  "final_answer": "Complete rigorous answer",
  "confidence_overall": 0-100,
  "remaining_uncertainty": "What I still don't know"
}`;
}

export function buildDebatePrompt(userMessage, context = {}) {
  return `You are an expert using structured debate reasoning.
Argue both sides fully, then synthesize to the best position.

QUESTION: ${userMessage}
CONTEXT: ${JSON.stringify(context)}

Respond in EXACT JSON:
{
  "thinking_mode": "debate",
  "thesis": "One clear statement of the question",
  "side_a": {
    "position": "Position A statement",
    "arguments": [
      { "point": "Argument", "evidence": "Supporting evidence", "strength": 0-100 }
    ],
    "strongest_argument": "The best argument for side A"
  },
  "side_b": {
    "position": "Position B statement",
    "arguments": [
      { "point": "Argument", "evidence": "Supporting evidence", "strength": 0-100 }
    ],
    "strongest_argument": "The best argument for side B"
  },
  "synthesis": "What both sides agree on",
  "verdict": "Best answer after weighing both sides",
  "final_answer": "Best answer after weighing both sides",
  "confidence_overall": 0-100,
  "nuances": ["important nuance 1", "important nuance 2"]
}`;
}

export function buildSocraticPrompt(userMessage, context = {}) {
  return `You are an expert using Socratic method.
First identify what you need to know, then answer building from fundamentals up.

QUESTION: ${userMessage}
CONTEXT: ${JSON.stringify(context)}

Respond in EXACT JSON:
{
  "thinking_mode": "socratic",
  "clarifying_questions": [
    { "question": "Q?", "why_needed": "Reason", "assumed_answer": "Best guess if not answered" }
  ],
  "foundational_concepts": [
    { "concept": "Name", "definition": "Simple definition", "relevance": "Why needed for answer" }
  ],
  "reasoning_chain": [
    { "from": "Foundation/prior step", "to": "New insight", "logic": "How we get there" }
  ],
  "final_answer": "Complete answer built from foundations",
  "teaching_summary": "How to explain this to a beginner in 2 sentences",
  "confidence_overall": 0-100
}`;
}

/**
 * @param {string} mode
 * @param {string} userMessage
 * @param {object} [context]
 * @param {Array<{ name: string, description: string }>} [tools]
 * @returns {string}
 */
export function buildPromptForMode(mode, userMessage, context = {}, tools = []) {
  const builders = {
    [THINKING_MODES.DIRECT]: () => userMessage,
    [THINKING_MODES.COT]: () => buildCOTPrompt(userMessage, context),
    [THINKING_MODES.TOT]: () => buildTOTPrompt(userMessage, context),
    [THINKING_MODES.REACT]: () => buildReActPrompt(userMessage, context, tools),
    [THINKING_MODES.SELF_REFINE]: () => buildSelfRefinePrompt(userMessage, context),
    [THINKING_MODES.HUMAN_THINK]: () => buildHumanThinkPrompt(userMessage, context),
    [THINKING_MODES.EXTENDED]: () => buildExtendedThinkingPrompt(userMessage, context),
    [THINKING_MODES.DEBATE]: () => buildDebatePrompt(userMessage, context),
    [THINKING_MODES.SOCRATIC]: () => buildSocraticPrompt(userMessage, context),
  };
  return (builders[mode] || builders[THINKING_MODES.COT])();
}

// ---------------------------------------------------------------------------
// PART B (legacy): prose system prompts for streaming providers
// ---------------------------------------------------------------------------

export function buildThinkingEngineRules() {
  return [
    'OWNAI AI THINKING ENGINE RULES (mandatory):',
    '- DIRECT: concise answer, minimal preamble.',
    '- Chain of Thought: show intermediate steps; never jump directly to the final answer.',
    '- Tree of Thoughts: generate 3 branches, score each 0-100, pick the best, explain rejections.',
    '- ReAct: alternate Thought → Action → Observation until the answer is found.',
    '- Self-Refine: draft → critique → improve → repeat up to 3 refinement rounds.',
    '- Human Think: inner monologue → draft → self-critique → improve like a careful human.',
    '- Extended Thinking: scratchpad reasoning before the final answer on hard problems.',
    '- Socratic: ask 2-3 clarifying questions, then teach through guided discovery.',
    '- Debate: argue Side A and Side B, then synthesize a balanced conclusion.',
    '- Confidence: end with JSON: {"confidence":0-100,"confidence_reasoning":"..."}',
  ].join('\n');
}

const MODE_INSTRUCTIONS = {
  [THINKING_MODES.DIRECT]: [
    'Respond concisely and directly.',
    'Skip extended reasoning unless the user asks for it.',
    'Format:',
    '## Answer',
    '[clear, complete response]',
  ].join('\n'),

  [THINKING_MODES.COT]: [
    'Use explicit numbered intermediate steps before the final answer.',
    'Never skip steps or jump to the conclusion.',
    'Format:',
    '## Steps',
    '1. ...',
    '2. ...',
    '## Final Answer',
    '...',
  ].join('\n'),

  [THINKING_MODES.TOT]: [
    'Generate exactly 3 solution branches.',
    'Score each branch 0-100 on correctness, completeness, and clarity.',
    'Select the best branch and explain why the other two were rejected.',
    'Format:',
    '## Branch A (score: NN)',
    '## Branch B (score: NN)',
    '## Branch C (score: NN)',
    '## Selected Branch',
    '## Rejected Because',
  ].join('\n'),

  [THINKING_MODES.REACT]: [
    'Use ReAct cycles until the task is complete.',
    'Repeat blocks:',
    'Thought: ...',
    'Action: ...',
    'Observation: ...',
    'End with:',
    'Final Answer: ...',
  ].join('\n'),

  [THINKING_MODES.SELF_REFINE]: [
    'Round 1: Initial draft.',
    'Round 2: Critique — list specific flaws in the draft.',
    'Round 3: Improved answer addressing every critique.',
    'Optional Round 4: Second critique + final polish (max 3 refinement rounds total).',
    'Label each round clearly.',
  ].join('\n'),

  [THINKING_MODES.HUMAN_THINK]: [
    'Think like a careful human: inner monologue first, then draft, then honest self-critique, then improve.',
    'Show doubt, reframing, and what you would fix before the final answer.',
    'Format:',
    '## Inner Monologue',
    '## Draft',
    '## Self-Critique',
    '## Improved Answer',
    '## Final Answer',
  ].join('\n'),

  [THINKING_MODES.EXTENDED]: [
    'Hard problem — use extended scratchpad thinking first.',
    'Consider assumptions, edge cases, and failure modes.',
    'Format:',
    '## Scratchpad (Extended Thinking)',
    '[detailed reasoning]',
    '## Final Answer',
    '[concise, verified conclusion]',
  ].join('\n'),

  [THINKING_MODES.SOCRATIC]: [
    'Use the Socratic method: guide through questions, not lectures.',
    'Format:',
    '## Clarifying Questions',
    '1. ...',
    '2. ...',
    '## Guided Discovery',
    '[step-by-step explanation building on likely answers]',
    '## Final Answer',
    '...',
  ].join('\n'),

  [THINKING_MODES.DEBATE]: [
    'Present both sides fairly before synthesizing.',
    'Format:',
    '## Side A (Pro)',
    '## Side B (Con)',
    '## Cross-Examination',
    '[where each side is weakest]',
    '## Synthesis',
    '[balanced conclusion with conditions]',
  ].join('\n'),
};

/**
 * @param {string} mode
 * @returns {string}
 */
export function buildReasoningSystemPrompt(mode) {
  const instructions = MODE_INSTRUCTIONS[mode] || MODE_INSTRUCTIONS[THINKING_MODES.COT];
  return [buildThinkingEngineRules(), '', instructions].join('\n');
}

/**
 * @param {string} prompt
 * @param {string} mode
 * @param {object} [context]
 * @param {Array} [tools]
 * @returns {string}
 */
export function wrapUserPromptForMode(prompt, mode, context = {}, tools = []) {
  if (mode === THINKING_MODES.DIRECT) {
    return prompt;
  }
  return buildPromptForMode(mode, prompt, context, tools);
}

// ---------------------------------------------------------------------------
// PART C: RESPONSE PARSER
// ---------------------------------------------------------------------------

/**
 * @param {string} rawText
 * @param {string} mode
 * @returns {object}
 */
export function parseThinkingResponse(rawText, mode) {
  let cleaned = String(rawText || '').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) {
    return {
      thinking_mode: mode,
      final_answer: rawText,
      confidence_overall: 50,
      parse_error: 'No JSON found in response',
    };
  }

  const jsonStr = cleaned.slice(start, end + 1);

  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed.final_answer) {
      parsed.final_answer = parsed.verdict || parsed.final_thought || cleaned;
    }
    if (parsed.confidence_overall === undefined) {
      parsed.confidence_overall = 70;
    }
    return parsed;
  } catch (error) {
    return {
      thinking_mode: mode,
      final_answer: rawText,
      confidence_overall: 50,
      parse_error: error.message,
    };
  }
}

/**
 * Extract display thinking text from a parsed JSON thinking response.
 * @param {object} parsed
 * @returns {string}
 */
export function extractThinkingFromParsed(parsed) {
  if (!parsed || typeof parsed !== 'object') return '';

  const copy = { ...parsed };
  delete copy.final_answer;
  delete copy.confidence_overall;
  delete copy.thinking_mode;
  delete copy.parse_error;

  if (!Object.keys(copy).length) return '';
  return JSON.stringify(copy, null, 2);
}

/**
 * Normalize model output — prefer structured JSON, fall back to prose split.
 * @param {string} rawText
 * @param {string} mode
 * @returns {{ answer: string, thinking: string, confidence: number|null, structured: object|null }}
 */
export function normalizeThinkingOutput(rawText, mode) {
  const parsed = parseThinkingResponse(rawText, mode);

  if (!parsed.parse_error && parsed.final_answer) {
    return {
      answer: parsed.final_answer,
      thinking: extractThinkingFromParsed(parsed),
      confidence: parsed.confidence_overall ?? null,
      structured: parsed,
    };
  }

  const split = splitThinkingAndAnswer(rawText);
  const legacyConfidence = parseConfidenceFromOutput(split.answer || rawText);

  return {
    answer: legacyConfidence.cleanedText || split.answer || rawText,
    thinking: split.thinking,
    confidence: legacyConfidence.score,
    structured: null,
  };
}

// ---------------------------------------------------------------------------
// PART C (legacy): prose confidence + split helpers
// ---------------------------------------------------------------------------

/**
 * @param {string} text
 * @returns {{ score: number|null, reasoning: string|null, cleanedText: string }}
 */
export function parseConfidenceFromOutput(text) {
  if (!text?.trim()) {
    return { score: null, reasoning: null, cleanedText: text || '' };
  }

  const jsonLineMatch = text.match(/\{"confidence"\s*:\s*(\d+(?:\.\d+)?)[^}]*\}\s*$/m);
  if (jsonLineMatch) {
    try {
      const parsed = JSON.parse(jsonLineMatch[0]);
      const score = Math.max(0, Math.min(100, Number(parsed.confidence)));
      const reasoning = parsed.confidence_reasoning || parsed.reasoning || null;
      const cleanedText = text.replace(jsonLineMatch[0], '').trimEnd();
      return { score: Number.isFinite(score) ? score : null, reasoning, cleanedText };
    } catch {
      // fall through
    }
  }

  const inlineMatch = text.match(/confidence\s*[:\-]\s*(\d{1,3})\s*(?:\/\s*100)?/i);
  if (inlineMatch) {
    const score = Math.max(0, Math.min(100, Number(inlineMatch[1])));
    return { score, reasoning: null, cleanedText: text };
  }

  return { score: null, reasoning: null, cleanedText: text };
}

/**
 * @param {string} text
 * @returns {{ thinking: string, answer: string }}
 */
export function splitThinkingAndAnswer(text) {
  if (!text?.trim()) return { thinking: '', answer: '' };

  const thinkingPatterns = [
    /##\s*Scratchpad[\s\S]*?(?=##\s*Final Answer|$)/i,
    /##\s*Steps[\s\S]*?(?=##\s*Final Answer|$)/i,
    /##\s*Branch [ABC][\s\S]*?(?=##\s*Selected Branch|##\s*Final Answer|$)/i,
    /##\s*Clarifying Questions[\s\S]*?(?=##\s*Guided Discovery|##\s*Final Answer|$)/i,
    /##\s*Side [AB][\s\S]*?(?=##\s*Synthesis|##\s*Final Answer|$)/i,
    /((?:Thought:|Action:|Observation:)[\s\S]*?)(?=Final Answer:|##\s*Final Answer|$)/i,
    /(Round \d:[\s\S]*?)(?=Round \d:|##\s*Final Answer|Final Answer:|$)/i,
  ];

  let thinkingBlock = '';
  for (const pattern of thinkingPatterns) {
    const match = text.match(pattern);
    if (match?.[0]?.trim()) {
      thinkingBlock = match[0].trim();
      break;
    }
  }

  const finalMatch = text.match(/(?:##\s*Final Answer|Final Answer:|##\s*Synthesis|##\s*Answer)\s*([\s\S]*)/i);
  if (finalMatch) {
    return { thinking: thinkingBlock, answer: finalMatch[1].trim() };
  }

  if (thinkingBlock) {
    return { thinking: thinkingBlock, answer: text.replace(thinkingBlock, '').trim() };
  }

  return { thinking: '', answer: text.trim() };
}

// ---------------------------------------------------------------------------
// PART D: PROVIDER HINTS & FALLBACK
// ---------------------------------------------------------------------------

/**
 * @param {string} mode
 * @param {boolean} anthropicAvailable
 * @returns {boolean}
 */
export function shouldUseAnthropicExtendedThinking(mode, anthropicAvailable) {
  if (!anthropicAvailable) return false;
  return [
    THINKING_MODES.EXTENDED,
    THINKING_MODES.HUMAN_THINK,
    THINKING_MODES.COT,
    THINKING_MODES.TOT,
    THINKING_MODES.DEBATE,
  ].includes(mode);
}

/**
 * @param {string} mode
 * @returns {boolean}
 */
export function modeShowsScratchpad(mode) {
  return mode !== THINKING_MODES.DIRECT;
}

export function buildFallbackResponse(error) {
  return {
    text: 'I encountered an issue while reasoning through your request. Please rephrase your question or try again in a moment.',
    thinking: `Fallback activated due to: ${error?.message || 'unknown error'}`,
    confidence: { score: 20, reasoning: 'Fallback response — model call failed.' },
  };
}

/**
 * Build metadata event payload for SSE streams.
 * @param {{ mode: string, confidence: number, reason: string, autoDetected: boolean }} resolved
 * @param {object} [extras]
 */
export function buildModeMeta(resolved, extras = {}) {
  return {
    type: 'meta',
    reasoning_mode: resolved.mode,
    mode_confidence: resolved.confidence,
    mode_reason: resolved.reason,
    auto_detected: resolved.autoDetected,
    ...extras,
  };
}
