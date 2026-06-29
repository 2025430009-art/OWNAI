import { applyAlgorithm } from '../../services/algorithmService.js';
import { buildRagContext, augmentPromptWithRag, buildRagSystemPrompt } from '../../rag/ragChain.js';
import { resolveRagNamespace } from '../../rag/namespace.js';
import { applyResearchChatAugmentation } from '../../research/ragIntegration.js';
import { enrichWithResearchContext } from '../../research/researchChatContext.js';
import { resolveDbUserId } from '../../services/thinkingLogService.js';
import {
  buildMemoryContext,
  applyMemoryPrefixToHistory,
} from '../../ai/memoryEngine.js';

/** Build inference context from an HTTP request + validated payload. */
export async function prepareGenerationFromRequest(req, validated) {
  const {
    prompt,
    messages,
    max_tokens,
    temperature,
    model_key,
    model_src,
    algorithm_id,
    use_rag,
    reasoning_mode,
    enable_thinking,
  } = validated;

  const shaped = applyAlgorithm(algorithm_id, prompt);
  let finalPrompt = shaped.prompt;

  const researchPrefix = await enrichWithResearchContext(req, finalPrompt).catch(() => null);
  if (researchPrefix) {
    finalPrompt = researchPrefix + finalPrompt;
  }

  const ragNamespace = resolveRagNamespace(req);
  const ragContext = ragNamespace
    ? await buildRagContext(finalPrompt, 4, ragNamespace).catch(() => null)
    : null;

  let conversationHistory = augmentPromptWithRag(finalPrompt, ragContext, messages || []);

  if (req.user?.id) {
    conversationHistory = await applyResearchChatAugmentation(
      conversationHistory,
      finalPrompt,
      req.user.id,
    ).catch(() => conversationHistory);
  }

  const dbUserId = resolveDbUserId(req);
  if (dbUserId) {
    const memoryPrefix = await buildMemoryContext(finalPrompt, dbUserId).catch(() => '');
    conversationHistory = applyMemoryPrefixToHistory(conversationHistory, memoryPrefix);
  }

  const thinkingContext = {
    hasResearchContext: Boolean(researchPrefix),
    isResearch: Boolean(researchPrefix),
    ragContext: ragContext || '',
    ragSystemPrompt: buildRagSystemPrompt(ragContext),
  };

  return {
    shaped,
    finalPrompt,
    dbUserId,
    generationParams: {
      prompt: finalPrompt,
      history: conversationHistory,
      maxTokens: max_tokens,
      temperature: temperature ?? shaped.temperature ?? 0.7,
      modelKey: model_key,
      modelSrc: model_src,
      reasoningMode: enable_thinking ? reasoning_mode : 'direct',
      context: thinkingContext,
    },
    meta: shaped.meta,
  };
}
