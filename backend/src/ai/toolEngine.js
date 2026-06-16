import { buildSafeObjective, SafeExpressionError } from '../utils/safeExpression.js';
import { vectorStore } from '../rag/vectorStore.js';
import { runThinkingGeneration } from '../services/thinkingGenerationService.js';
import { logger } from '../utils/logger.js';

const UNSAFE_CODE_PATTERNS = [
  /\bimport\s+os\b/i,
  /\brequire\s*\(\s*['"]child_process['"]\s*\)/i,
  /\bexec\s*\(/i,
  /\beval\s*\(/i,
  /\b__import__\s*\(/i,
  /\bsubprocess\b/i,
  /\bprocess\.env\b/i,
  /\bfs\.(?:read|write|unlink)/i,
];

async function webSearchExecute({ query }) {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    return {
      results: [`Search results for: ${query} — integrate real search API here`],
      note: 'Set SERPER_API_KEY for live web search',
    };
  }

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num: 5 }),
    });

    if (!response.ok) {
      throw new Error(`Serper API error (${response.status})`);
    }

    const data = await response.json();
    const results = (data.organic || []).map((item) => ({
      title: item.title,
      snippet: item.snippet,
      link: item.link,
    }));

    return { results, source: 'serper' };
  } catch (error) {
    logger.warn('Web search failed', { error: error.message });
    return {
      results: [],
      error: error.message,
      note: 'Web search failed — check SERPER_API_KEY',
    };
  }
}

function calculatorExecute({ expression }) {
  try {
    const fn = buildSafeObjective(String(expression || ''), 0);
    const result = fn([0]);
    if (!Number.isFinite(result)) {
      return { error: 'Expression returned non-finite value' };
    }
    return { result: String(result), expression };
  } catch (error) {
    const message = error instanceof SafeExpressionError ? error.message : error.message;
    return { error: `Cannot compute: ${message}` };
  }
}

function isUnsafeCode(code) {
  return UNSAFE_CODE_PATTERNS.some((pattern) => pattern.test(code));
}

async function codeRunnerExecute({ code, language = 'javascript' }) {
  const snippet = String(code || '');
  const lang = String(language || 'javascript').toLowerCase();

  if (!snippet.trim()) {
    return { error: 'No code provided' };
  }

  if (isUnsafeCode(snippet)) {
    return { error: 'Unsafe code detected — system calls not allowed' };
  }

  return {
    output: `[Sandboxed execution of ${lang} code — ${snippet.length} chars]`,
    note: 'Integrate Docker sandbox for real execution',
    language: lang,
  };
}

async function ragSearchExecute({ query, namespace }, userId) {
  const ns = namespace || (userId != null ? String(userId) : 'global');
  try {
    const results = await vectorStore.search(String(query || ''), 3, ns);
    return {
      chunks: results.map(({ id, source, text, score }) => ({ id, source, text, score })),
      source: 'user_knowledge_base',
      namespace: ns,
    };
  } catch (error) {
    return { error: error.message };
  }
}

async function memoryReadExecute({ topic }, userId) {
  if (!userId) {
    return { memory: [], note: 'No user context for memory lookup' };
  }

  try {
    const { recallRelevantMemories } = await import('./memoryEngine.js');
    const memories = await recallRelevantMemories(String(topic || ''), userId, 5);
    if (memories.length) {
      return {
        memory: memories.map((m) => ({
          type: m.type,
          content: m.content,
          confidence: m.confidence,
          tags: m.tags,
        })),
        topic,
      };
    }
    return { memory: `No memories matched topic "${topic}" for user ${userId}` };
  } catch (error) {
    return { memory: `Memory about "${topic}" for user ${userId}`, error: error.message };
  }
}

async function knowledgeGraphExecute({ concept, relation_type }, userId) {
  const label = String(concept || 'unknown');
  const relation = relation_type ? ` (${relation_type})` : '';

  if (!userId) {
    return {
      concept: label,
      related: [],
      note: 'No user context for knowledge graph lookup',
    };
  }

  try {
    const { getKnowledgeGraph } = await import('./memoryEngine.js');
    const graph = await getKnowledgeGraph(userId);
    const needle = label.toLowerCase();

    const relatedEdges = graph.edges.filter(
      (edge) => edge.from_content?.toLowerCase().includes(needle)
        || edge.to_content?.toLowerCase().includes(needle)
        || (relation_type && edge.relation === relation_type),
    );

    if (relatedEdges.length) {
      return {
        concept: label,
        related: relatedEdges.map(
          (edge) => `${edge.from_content} → ${edge.relation} → ${edge.to_content} (strength: ${edge.strength})`,
        ),
        nodes: graph.nodes.filter(
          (node) => node.content?.toLowerCase().includes(needle),
        ),
      };
    }

    const relatedNodes = graph.nodes.filter((node) => node.content?.toLowerCase().includes(needle));
    if (relatedNodes.length) {
      return {
        concept: label,
        related: relatedNodes.map((node) => `[${node.type}] ${node.content}`),
        nodes: relatedNodes,
      };
    }
  } catch {
    // fall through to mock
  }

  return {
    concept: label,
    related: [
      `${label} → relates to → [concept B]${relation}`,
      `${label} → is part of → [concept C]${relation}`,
    ],
    note: 'No stored graph edges yet — memories will build the graph over time',
  };
}

export const BUILTIN_TOOLS = {
  web_search: {
    name: 'web_search',
    description: 'Search the internet for current information',
    parameters: { query: 'string' },
    execute: webSearchExecute,
  },

  calculator: {
    name: 'calculator',
    description: 'Evaluate mathematical expressions safely',
    parameters: { expression: 'string' },
    execute: async ({ expression }) => calculatorExecute({ expression }),
  },

  code_runner: {
    name: 'code_runner',
    description: 'Execute Python or JavaScript code snippets safely',
    parameters: { code: 'string', language: 'python|javascript' },
    execute: codeRunnerExecute,
  },

  rag_search: {
    name: 'rag_search',
    description: 'Search user documents and knowledge base',
    parameters: { query: 'string', namespace: 'string (optional)' },
    execute: ragSearchExecute,
  },

  memory_read: {
    name: 'memory_read',
    description: 'Read from user conversation memory',
    parameters: { topic: 'string' },
    execute: memoryReadExecute,
  },

  knowledge_graph: {
    name: 'knowledge_graph',
    description: 'Query relationships between concepts the user has discussed',
    parameters: { concept: 'string', relation_type: 'string (optional)' },
    execute: knowledgeGraphExecute,
  },
};

export function getToolDefinitions(tools) {
  return resolveAvailableTools(tools).map(({ name, description, parameters }) => ({
    name,
    description,
    parameters,
  }));
}

export function resolveAvailableTools(tools) {
  const map = new Map(Object.values(BUILTIN_TOOLS).map((tool) => [tool.name, tool]));

  for (const tool of tools || []) {
    if (!tool?.name) continue;
    if (typeof tool.execute === 'function') {
      map.set(tool.name, tool);
      continue;
    }
    if (BUILTIN_TOOLS[tool.name]) {
      map.set(tool.name, BUILTIN_TOOLS[tool.name]);
    } else {
      map.set(tool.name, {
        name: tool.name,
        description: tool.description || tool.name,
        parameters: tool.parameters || {},
        execute: async () => ({ error: `Tool "${tool.name}" has no executor registered` }),
      });
    }
  }

  return [...map.values()];
}

export function buildToolMap(tools) {
  return Object.fromEntries(resolveAvailableTools(tools).map((tool) => [tool.name, tool]));
}

export async function executeTool(toolName, input, userId, tools) {
  const tool = buildToolMap(tools)[toolName];
  if (!tool) {
    return { error: `Unknown tool: ${toolName}` };
  }

  try {
    return await tool.execute(input || {}, userId);
  } catch (error) {
    return { error: `Tool ${toolName} failed: ${error.message}` };
  }
}

export function buildReActStepPrompt(originalMessage, priorCycles, tools) {
  const history = priorCycles.map((cycle) =>
    `Cycle ${cycle.cycle}:\nThought: ${cycle.thought}\nAction: ${JSON.stringify(cycle.action)}\nObservation: ${JSON.stringify(cycle.observation)}`,
  ).join('\n\n');

  const toolList = resolveAvailableTools(tools)
    .map((tool) => `${tool.name}: ${tool.description}`)
    .join(' | ');

  return `You are solving a problem using ReAct.
ORIGINAL PROBLEM: ${originalMessage}

PRIOR CYCLES:
${history || '(none yet — this is cycle 1)'}

AVAILABLE TOOLS: ${toolList}

What is your next thought and action? Respond in JSON only:
{
  "thought": "Current reasoning given what we know",
  "action": { "tool": "tool_name_or_none", "input": { "param": "value" } },
  "is_final": false,
  "final_answer": "only fill if is_final=true"
}`;
}

export function buildUpdatedContext(original, cycles) {
  return `Original: ${original}\nLearned so far:\n${
    cycles.map((cycle) => `- ${cycle.thought}: ${JSON.stringify(cycle.observation)}`).join('\n')
  }`;
}

export function parseReActStep(rawText) {
  let cleaned = String(rawText || '').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');

  if (start === -1 || end === -1) {
    return {
      thought: cleaned,
      action: { tool: 'none', input: {} },
      is_final: true,
      final_answer: cleaned,
      parse_error: 'No JSON found in ReAct step',
    };
  }

  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return {
      thought: parsed.thought || '',
      action: parsed.action || { tool: 'none', input: {} },
      is_final: Boolean(parsed.is_final),
      final_answer: parsed.final_answer || null,
    };
  } catch (error) {
    return {
      thought: cleaned,
      action: { tool: 'none', input: {} },
      is_final: true,
      final_answer: cleaned,
      parse_error: error.message,
    };
  }
}

async function defaultCallAI(prompt, context = {}) {
  let output = '';

  await runThinkingGeneration({
    prompt,
    history: context.history || [],
    maxTokens: context.maxTokens || 1024,
    temperature: 0.2,
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
 * Run the full Reason → Act → Observe loop for ReAct mode.
 * @param {string} message
 * @param {object} [context]
 * @param {Array} [tools]
 * @param {number} [maxCycles=6]
 * @param {{ callAI?: Function, onCycle?: Function }} [options]
 */
export async function executeReActLoop(message, context = {}, tools, maxCycles = 6, options = {}) {
  const { callAI = defaultCallAI, onCycle } = options;
  const availableTools = resolveAvailableTools(tools);
  const toolMap = Object.fromEntries(availableTools.map((tool) => [tool.name, tool]));
  const userId = context.userId ?? null;

  const cycles = [];
  let currentContext = message;
  const startTime = Date.now();

  for (let i = 0; i < maxCycles; i += 1) {
    const thinkPrompt = buildReActStepPrompt(currentContext, cycles, availableTools);
    const aiResponse = await callAI(thinkPrompt, context);
    const step = parseReActStep(aiResponse);

    const actionTool = step.action?.tool;
    const isDone = step.is_final || actionTool === 'none' || !actionTool;

    if (isDone) {
      const finalCycle = {
        ...step,
        cycle: i + 1,
        observation: step.observation || null,
      };
      cycles.push(finalCycle);
      onCycle?.(finalCycle);
      break;
    }

    let observation;
    const tool = toolMap[actionTool];
    if (tool) {
      try {
        observation = await tool.execute(step.action.input || {}, userId);
      } catch (error) {
        observation = { error: `Tool ${actionTool} failed: ${error.message}` };
      }
    } else {
      observation = { error: `Unknown tool: ${actionTool}` };
    }

    const cycleRecord = {
      ...step,
      cycle: i + 1,
      observation,
    };
    cycles.push(cycleRecord);
    onCycle?.(cycleRecord);

    currentContext = buildUpdatedContext(message, cycles);
  }

  const lastCycle = cycles[cycles.length - 1];

  return {
    cycles,
    final_answer: lastCycle?.final_answer
      || lastCycle?.thought
      || 'ReAct loop did not converge',
    tools_used: [...new Set(
      cycles
        .map((cycle) => cycle.action?.tool)
        .filter((tool) => tool && tool !== 'none'),
    )],
    total_duration_ms: Date.now() - startTime,
  };
}
