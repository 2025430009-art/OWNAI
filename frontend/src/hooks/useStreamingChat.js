import { useState, useCallback } from 'react';
import { generateText, queryRag, thinkMessage } from '../api/client.js';
import { consumeThinkingSse } from '../utils/thinkingStreamClient.js';
import { runHumanThinkPipeline } from '../utils/humanThinkPipeline.js';
import { streamOllamaChat, resolveOllamaModel } from '../utils/ollamaClient.js';
import { streamPromptResponse } from '../utils/promptEngine.js';
import { buildChatMessages, resolveHistory } from '../utils/memory.js';
import ownaiMemory from '../utils/ownaiMemory.js';
import { detectTask } from '../utils/modelRouter.js';
import { apiModeFromUiId, shouldUseThinkEndpoint } from '../constants/thinkingModes.js';
import {
  detectAIMode,
  AI_MODES,
  canReachBackend,
  friendlyAIError,
} from '../utils/apiConfig.js';

async function consumeStream(tokenStream, onToken) {
  let accumulated = '';
  for await (const token of tokenStream) {
    accumulated += token;
    onToken?.(accumulated, token);
  }
  return accumulated;
}

async function streamBackendSse(response, onToken, onThinking, onConfidence, onMeta, onThinkingResult) {
  return consumeThinkingSse(response, {
    onText: (full) => onToken?.(full),
    onThinking: (full) => onThinking?.(full),
    onConfidence: (conf) => onConfidence?.(conf),
    onMeta: (meta) => onMeta?.(meta),
    onThinkingResult: (tr) => onThinkingResult?.(tr),
  });
}

/**
 * Premium streaming chat hook — model routing, memory, RAG, token streaming.
 */
export default function useStreamingChat() {
  const [tokens, setTokens] = useState('');
  const [thinking, setThinking] = useState(false);
  const [activeModel, setActiveModel] = useState('llama3.2:3b');
  const [activeMode, setActiveMode] = useState('FAST MODE');
  const [memoryFacts, setMemoryFacts] = useState(() => ownaiMemory.getFacts());

  const sendMessage = useCallback(async ({
    message,
    history = [],
    onToken,
    onThinking,
    onConfidence,
    onMeta,
    onThinkingResult,
    temperature = 0.7,
    max_tokens = 512,
    model_key,
    algorithm_id,
    useRag = true,
    thinkingModeUi = 'auto',
    sessionId,
  }) => {
    const prompt = message.trim();
    if (!prompt) return { content: '', model: activeModel, mode: activeMode };

    const task = detectTask(prompt);
    setActiveMode(task.mode);

    const currentAiMode = await detectAIMode();
    const resolvedHistory = history.length ? history.slice(-10) : resolveHistory([]);

    let ragContext = '';
    if (useRag && await canReachBackend()) {
      try {
        const rag = await queryRag(prompt);
        ragContext = rag.context || '';
      } catch {
        // RAG optional
      }
    }

    const chatMessages = buildChatMessages({
      history: resolvedHistory,
      userPrompt: prompt,
      ragContext,
      taskMode: task.mode,
    });

    let modelLabel = task.model;
    if (currentAiMode === AI_MODES.LOCAL) {
      modelLabel = await resolveOllamaModel(task.model);
    } else if (currentAiMode === AI_MODES.BACKEND) {
      modelLabel = model_key || 'QVAC Llama 3.2';
    } else {
      modelLabel = 'prompt-engine';
    }
    setActiveModel(modelLabel);
    setThinking(true);
    setTokens('');

    const handleToken = (full) => {
      setTokens(full);
      onToken?.(full);
    };

    const persist = (content, extra = {}) => {
      ownaiMemory.remember('user', prompt);
      ownaiMemory.remember('assistant', content);
      setMemoryFacts(ownaiMemory.getFacts());
      return { content, model: modelLabel, mode: task.mode, ...extra };
    };

    try {
      if (currentAiMode === AI_MODES.LOCAL) {
        const content = await consumeStream(
          streamOllamaChat({ messages: chatMessages, model: modelLabel, temperature }),
          handleToken,
        );
        return persist(content);
      }

      if (await canReachBackend()) {
        const useThink = shouldUseThinkEndpoint(thinkingModeUi, false);
        const apiMode = apiModeFromUiId(thinkingModeUi);

        if (useThink && apiMode === 'human_think') {
          const humanResult = await runHumanThinkPipeline({
            message: prompt,
            context: { score_confidence: true, working_memory: resolvedHistory },
            onToken: handleToken,
            onThinking: (thinking) => onThinking?.(thinking),
            onConfidence: (conf) => onConfidence?.(conf),
            onMeta: (meta) => onMeta?.(meta),
            onThinkingResult: (tr) => onThinkingResult?.(tr),
          });
          return persist(humanResult.final_answer || '', {
            thinking: humanResult.thinking,
            confidence: humanResult.confidence,
            confidenceDetail: humanResult.confidenceDetail,
            thinkingResult: humanResult.thinkingResult,
            reasoningMode: humanResult.mode_used || 'human_think',
            modeReason: humanResult.pipeline_meta?.silent_fallback
              ? 'Human Think fell back to direct mode'
              : 'Mode explicitly set in request',
            autoDetected: false,
          });
        }

        const backendResponse = useThink
          ? await thinkMessage({
              message: prompt,
              mode: apiMode,
              sessionId,
              context: {
                score_confidence: true,
              },
              stream: true,
              use_extended_thinking: apiMode === 'extended',
            })
          : await generateText({
              prompt,
              messages: resolvedHistory,
              max_tokens,
              temperature,
              model_key,
              algorithm_id,
              stream: true,
              use_rag: useRag,
              enable_thinking: true,
              reasoning_mode: 'direct',
            });
        const streamed = await streamBackendSse(
          backendResponse,
          handleToken,
          (thinking) => onThinking?.(thinking),
          (conf) => onConfidence?.(conf),
          (meta) => onMeta?.(meta),
          (tr) => onThinkingResult?.(tr),
        );
        return persist(streamed.text || '', {
          thinking: streamed.thinking,
          confidence: streamed.confidence,
          confidenceDetail: streamed.confidence?.detail,
          thinkingResult: streamed.thinkingResult,
          reasoningMode: streamed.meta?.reasoning_mode,
          modeReason: streamed.meta?.mode_reason,
          autoDetected: streamed.meta?.auto_detected,
        });
      }

      const content = await consumeStream(streamPromptResponse(prompt), handleToken);
      return persist(content);
    } catch (error) {
      try {
        const content = await consumeStream(streamPromptResponse(prompt), handleToken);
        return persist(content);
      } catch {
        throw new Error(friendlyAIError(error));
      }
    } finally {
      setThinking(false);
    }
  }, [activeModel, activeMode]);

  const clearMemory = useCallback(() => {
    ownaiMemory.clear();
    setMemoryFacts({});
    setTokens('');
  }, []);

  return {
    tokens,
    thinking,
    activeModel,
    activeMode,
    sendMessage,
    clearMemory,
    memoryFacts,
  };
}
