import { runThinkingGeneration } from '../services/thinkingGenerationService.js';

function clampScore(value, fallback = 70) {
  const score = Number(value);
  if (!Number.isFinite(score)) return fallback;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function extractJSON(text) {
  const cleaned = String(text || '')
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  return cleaned.slice(start, end + 1);
}

export function extractDraft(response) {
  const text = String(response || '').trim();
  if (!text) return '';

  const jsonStr = extractJSON(text);
  if (jsonStr) {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.draft) return String(parsed.draft).trim();
      if (parsed.final_answer) return String(parsed.final_answer).trim();
      if (parsed.answer) return String(parsed.answer).trim();
    } catch {
      // fall through to raw text
    }
  }

  return text
    .replace(/^##\s*Answer\s*/i, '')
    .replace(/^Final Answer:\s*/i, '')
    .trim();
}

export function buildInitialDraftPrompt(message, context = {}) {
  return `Answer this question thoroughly:
${message}

Context: ${JSON.stringify(context)}
Give your best initial answer. Be comprehensive.`;
}

export function buildImprovementPrompt(message, previousDraft, critique) {
  return `Improve this answer based on the critique below.

ORIGINAL QUESTION: ${message}

PREVIOUS ANSWER:
${previousDraft}

CRITIQUE:
Weaknesses: ${(critique.weaknesses || []).join(', ') || 'none listed'}
Missing: ${(critique.missing || []).join(', ') || 'none listed'}
Score: ${critique.score}/100
Priority fix: ${critique.improvement_priority || 'Address all weaknesses'}

Write an improved answer that fixes these issues. Do not repeat the same mistakes.`;
}

export function buildCritiquePrompt(message, draft) {
  return `You are a harsh but fair critic. Evaluate this answer.

QUESTION: ${message}
ANSWER: ${draft}

Respond in JSON only:
{
  "score": 0-100,
  "weaknesses": ["what is wrong or incomplete"],
  "missing": ["what should be there but isn't"],
  "inaccuracies": ["factual errors if any"],
  "strengths": ["what is good"],
  "improvement_priority": "The single most important thing to fix"
}`;
}

export function parseCritique(rawText) {
  try {
    const jsonStr = extractJSON(rawText);
    if (!jsonStr) throw new Error('No JSON in critique response');
    const parsed = JSON.parse(jsonStr);
    return {
      score: clampScore(parsed.score, 50),
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
      missing: Array.isArray(parsed.missing) ? parsed.missing : [],
      inaccuracies: Array.isArray(parsed.inaccuracies) ? parsed.inaccuracies : [],
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      improvement_priority: parsed.improvement_priority || '',
    };
  } catch {
    return {
      score: 50,
      weaknesses: ['Critique parsing failed — answer may need manual review'],
      missing: [],
      inaccuracies: [],
      strengths: [],
      improvement_priority: 'Improve clarity and completeness',
      parse_error: true,
    };
  }
}

async function defaultCallAI(prompt, context = {}) {
  let output = '';

  await runThinkingGeneration({
    prompt,
    history: context.history || [],
    maxTokens: context.maxTokens || 2048,
    temperature: context.temperature ?? 0.3,
    reasoningMode: 'direct',
    context,
    onEvent: (event) => {
      if (event.type === 'text') output += event.token;
      if (event.type === 'text_replace') output = event.text;
    },
  });

  return output;
}

/**
 * Iterative self-improvement: generate → score → critique → improve.
 * @param {string} message
 * @param {object} [context]
 * @param {number} [maxIterations=3]
 * @param {{ callAI?: Function, onIteration?: Function }} [options]
 */
export async function selfRefineLoop(message, context = {}, maxIterations = 3, options = {}) {
  const { callAI = defaultCallAI, onIteration } = options;
  const iterations = [];
  let currentDraft = '';
  let previousScore = 0;
  const startTime = Date.now();

  for (let i = 1; i <= maxIterations; i += 1) {
    const prompt = i === 1
      ? buildInitialDraftPrompt(message, context)
      : buildImprovementPrompt(message, currentDraft, iterations[i - 2].critique);

    const response = await callAI(prompt, context);
    const draft = extractDraft(response);

    const critiquePrompt = buildCritiquePrompt(message, draft);
    const critiqueResponse = await callAI(critiquePrompt, { ...context, temperature: 0.1 });
    const critique = parseCritique(critiqueResponse);

    const iterationRecord = {
      iteration: i,
      draft,
      critique,
      score: critique.score,
    };
    iterations.push(iterationRecord);
    currentDraft = draft;

    onIteration?.(iterationRecord);

    if (critique.score >= 90) break;
    if (i > 1 && critique.score <= previousScore + 2) break;
    previousScore = critique.score;
  }

  const best = iterations.reduce(
    (bestSoFar, item) => (item.score > bestSoFar.score ? item : bestSoFar),
    iterations[0],
  );

  const firstScore = iterations[0]?.score ?? 0;
  const lastScore = iterations[iterations.length - 1]?.score ?? firstScore;

  return {
    thinking_mode: 'self_refine',
    iterations,
    best_iteration: best.iteration,
    final_answer: best.draft,
    score_progression: iterations.map((item) => item.score),
    improvement_delta: lastScore - firstScore,
    confidence_overall: best.score,
    total_duration_ms: Date.now() - startTime,
  };
}

function buildConfidenceScorePrompt(question, answer, context = {}) {
  return `Rate the confidence of this AI answer on multiple dimensions.

QUESTION: ${question}
ANSWER: ${answer}
CONTEXT: ${JSON.stringify(context)}

Respond in JSON only:
{
  "dimensions": {
    "factual_accuracy": { "score": 0-100, "reason": "..." },
    "completeness":     { "score": 0-100, "reason": "..." },
    "logical_validity": { "score": 0-100, "reason": "..." },
    "source_quality":   { "score": 0-100, "reason": "..." },
    "recency":          { "score": 0-100, "reason": "..." }
  },
  "overall": 0-100,
  "should_caveat": true,
  "caveat_text": "If should_caveat=true, what disclaimer to show",
  "high_uncertainty_areas": ["list what we are least sure about"]
}`;
}

function normalizeConfidenceResult(parsed) {
  const dimensions = parsed.dimensions || {};
  const normalizedDimensions = {};

  for (const [key, value] of Object.entries(dimensions)) {
    normalizedDimensions[key] = {
      score: clampScore(value?.score, 70),
      reason: value?.reason || '',
    };
  }

  const dimensionScores = Object.values(normalizedDimensions).map((d) => d.score);
  const computedOverall = dimensionScores.length
    ? Math.round(dimensionScores.reduce((sum, score) => sum + score, 0) / dimensionScores.length)
    : clampScore(parsed.overall, 70);

  return {
    dimensions: normalizedDimensions,
    overall: clampScore(parsed.overall, computedOverall),
    should_caveat: Boolean(parsed.should_caveat),
    caveat_text: parsed.caveat_text || '',
    high_uncertainty_areas: Array.isArray(parsed.high_uncertainty_areas)
      ? parsed.high_uncertainty_areas
      : [],
    explanation: parsed.explanation || parsed.caveat_text || '',
  };
}

/**
 * Multi-dimensional confidence scoring for a question/answer pair.
 * @param {string} question
 * @param {string} answer
 * @param {object} [context]
 * @param {{ callAI?: Function }} [options]
 */
export async function scoreResponseConfidence(question, answer, context = {}, options = {}) {
  const { callAI = defaultCallAI } = options;
  const scorePrompt = buildConfidenceScorePrompt(question, answer, context);

  try {
    const response = await callAI(scorePrompt, { ...context, temperature: 0.1 });
    const jsonStr = extractJSON(response);
    if (!jsonStr) throw new Error('No JSON in confidence response');
    const parsed = JSON.parse(jsonStr);
    return normalizeConfidenceResult(parsed);
  } catch {
    return {
      dimensions: {},
      overall: 70,
      should_caveat: true,
      caveat_text: 'Confidence assessment unavailable',
      high_uncertainty_areas: [],
      explanation: 'Confidence assessment unavailable',
    };
  }
}

function buildKnowledgeGapPrompt(question, partialAnswer) {
  return `Given this question and partial answer, identify knowledge gaps.

QUESTION: ${question}
PARTIAL ANSWER: ${partialAnswer}

What information is missing, uncertain, or needs verification?
Respond in JSON only:
{
  "gaps": [
    {
      "description": "What we don't know",
      "severity": "critical|important|minor",
      "suggested_tool": "web_search|rag_search|calculator|none",
      "search_query": "Exact query to fill this gap"
    }
  ],
  "can_answer_without_gaps": true,
  "minimum_gaps_needed": ["only these gaps are blockers"]
}`;
}

/**
 * Identify knowledge gaps that should be filled before answering confidently.
 * @param {string} question
 * @param {string} partialAnswer
 * @param {{ callAI?: Function }} [options]
 */
export async function detectKnowledgeGaps(question, partialAnswer, options = {}) {
  const { callAI = defaultCallAI } = options;
  const prompt = buildKnowledgeGapPrompt(question, partialAnswer);

  try {
    const response = await callAI(prompt, { temperature: 0.2 });
    const jsonStr = extractJSON(response);
    if (!jsonStr) throw new Error('No JSON in knowledge gap response');
    const parsed = JSON.parse(jsonStr);
    return {
      gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
      can_answer_without_gaps: parsed.can_answer_without_gaps !== false,
      minimum_gaps_needed: Array.isArray(parsed.minimum_gaps_needed)
        ? parsed.minimum_gaps_needed
        : [],
    };
  } catch {
    return {
      gaps: [],
      can_answer_without_gaps: true,
      minimum_gaps_needed: [],
    };
  }
}
