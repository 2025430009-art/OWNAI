import { useState, useEffect, useCallback } from 'react';
import { chatWithAttachments, queryRag, thinkMessage } from '../api/client.js';
import { chatSendMessage, chatRecvMsgWait } from '../bridge/chatBridge.js';
import { consumeThinkingSse } from '../utils/thinkingStreamClient.js';
import { runHumanThinkPipeline } from '../utils/humanThinkPipeline.js';
import { streamOllamaChat, resolveOllamaModel } from '../utils/ollamaClient.js';
import { streamFallbackChat } from '../utils/fallbackChat.js';
import { buildChatMessages, resolveHistory } from '../utils/memory.js';
import ownaiMemory from '../utils/ownaiMemory.js';
import { detectTask } from '../utils/modelRouter.js';
import { apiModeFromUiId, shouldUseThinkEndpoint } from '../constants/thinkingModes.js';
import { getOwnaiSessionId } from '../utils/sessionId.js';
import {
  detectAIMode,
  AI_MODES,
  getModeLabel,
  friendlyAIError,
  canReachBackend,
  USER_UNAVAILABLE_MSG,
} from '../utils/apiConfig.js';

async function consumeTokenStream(tokenStream, onToken) {
  let accumulated = '';
  for await (const token of tokenStream) {
    accumulated += token;
    onToken?.(accumulated, token);
  }
  return accumulated;
}

async function streamFromBackendSse(response, onToken, onThinking, onConfidence, onMeta, onThinkingResult) {
  const result = await consumeThinkingSse(response, {
    onText: (full) => onToken?.(full),
    onThinking: (full) => onThinking?.(full),
    onConfidence: (conf) => onConfidence?.(conf),
    onMeta: (meta) => onMeta?.(meta),
    onThinkingResult: (tr) => onThinkingResult?.(tr),
  });
  return result;
}

/**
 * Unified AI hook — Ollama → backend → prompt engine with routing + memory.
 */
export default function useAI() {
  const [mode, setMode] = useState(AI_MODES.STATIC);
  const [modeReady, setModeReady] = useState(false);
  const [taskMode, setTaskMode] = useState('FAST MODE');
  const [activeModel, setActiveModel] = useState('llama3.2:3b');
  const [memoryFacts, setMemoryFacts] = useState(() => ownaiMemory.getFacts());

  const refreshMode = useCallback(async () => {
    const detected = await detectAIMode();
    setMode(detected);
    setModeReady(true);
    return detected;
  }, []);

  useEffect(() => {
    refreshMode();
  }, [refreshMode]);

  const send = useCallback(async ({
    prompt,
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
    attachmentIds = [],
    sessionId: sessionIdParam,
    useRag = true,
    thinkingModeUi = 'auto',
  }) => {
    const sessionId = sessionIdParam || getOwnaiSessionId();
    let activeMode = mode;
    if (!modeReady) {
      activeMode = await refreshMode();
    }

    const task = detectTask(prompt);
    setTaskMode(task.mode);

    const resolvedHistory = history.length ? history.slice(-10) : resolveHistory([]);

    let ragContext = '';
    const ragSessionId = sessionId;
    if (useRag && !attachmentIds.length && await canReachBackend()) {
      try {
        const rag = await queryRag(prompt, 4, ragSessionId);
        ragContext = rag.context || '';
      } catch {
        // optional
      }
    }

    const chatMessages = buildChatMessages({
      history: resolvedHistory,
      userPrompt: prompt,
      ragContext,
      taskMode: task.mode,
    });

    let modelLabel = task.model;
    if (activeMode === AI_MODES.LOCAL) {
      modelLabel = await resolveOllamaModel(task.model);
    } else if (activeMode === AI_MODES.BACKEND) {
      modelLabel = model_key || 'QVAC Llama 3.2';
    } else {
      modelLabel = 'OWNAI';
    }
    setActiveModel(modelLabel);

    const persistMemory = (response, streamMeta = {}) => {
      ownaiMemory.remember('user', prompt);
      ownaiMemory.remember('assistant', response);
      setMemoryFacts(ownaiMemory.getFacts());
      return {
        content: response,
        model: modelLabel,
        mode: task.mode,
        ...streamMeta,
      };
    };

    try {
      if (activeMode === AI_MODES.LOCAL && !attachmentIds.length) {
        const tokens = streamOllamaChat({
          messages: chatMessages,
          model: modelLabel,
          temperature,
        });
        const result = await consumeTokenStream(tokens, onToken);
        return persistMemory(result);
      }

      const backendUp = await canReachBackend();
      if (backendUp) {
        const useThink = shouldUseThinkEndpoint(thinkingModeUi, attachmentIds.length > 0);
        const apiMode = apiModeFromUiId(thinkingModeUi);

        if (useThink && apiMode === 'human_think') {
          const humanResult = await runHumanThinkPipeline({
            message: prompt,
            context: {
              score_confidence: true,
              working_memory: resolvedHistory,
            },
            onToken: (full) => onToken?.(full),
            onThinking: (thinking) => onThinking?.(thinking),
            onConfidence: (conf) => onConfidence?.(conf),
            onMeta: (meta) => onMeta?.(meta),
            onThinkingResult: (tr) => onThinkingResult?.(tr),
          });
          return persistMemory(humanResult.final_answer || '', {
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

        const response = attachmentIds.length
          ? await chatWithAttachments({
              prompt,
              attachmentIds,
              sessionId,
              max_tokens,
              temperature,
              model_key,
              algorithm_id,
              stream: true,
            })
          : useThink
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
            : await chatSendMessage({
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
                sessionId,
              }, { sessionId });

        const streamed = await chatRecvMsgWait(response, {
          onText: (full) => onToken?.(full),
          onThinking: (thinking) => onThinking?.(thinking),
          onConfidence: (conf) => onConfidence?.(conf),
          onMeta: (meta) => onMeta?.(meta),
          onThinkingResult: (tr) => onThinkingResult?.(tr),
        });
        return persistMemory(streamed.text || '', {
          thinking: streamed.thinking,
          confidence: streamed.confidence,
          confidenceDetail: streamed.confidence?.detail,
          meta: streamed.meta,
          thinkingResult: streamed.thinkingResult,
          reasoningMode: streamed.meta?.reasoning_mode,
          modeReason: streamed.meta?.mode_reason,
          autoDetected: streamed.meta?.auto_detected,
        });
      }

      if (attachmentIds.length) {
        const msg = USER_UNAVAILABLE_MSG;
        await consumeTokenStream((async function* () { yield msg; }()), onToken);
        return { content: msg, model: modelLabel, mode: task.mode };
      }

      setMode(AI_MODES.STATIC);
      if (ragContext?.trim()) {
        throw new Error(USER_UNAVAILABLE_MSG);
      }
      const result = await consumeTokenStream(
        streamFallbackChat({ prompt, chatMessages, maxTokens: max_tokens }),
        onToken,
      );
      return persistMemory(result);
    } catch (error) {
      if (attachmentIds.length) {
        throw new Error(USER_UNAVAILABLE_MSG);
      }
      const msg = error?.message || '';
      const canUseOfflineFallback = /backend not connected|unreachable|timed out|failed to fetch|502|503|404|health check/i.test(msg);
      if (!canUseOfflineFallback) {
        throw new Error(friendlyAIError(error));
      }
      try {
        if (ragContext?.trim()) {
          throw error;
        }
        setMode(AI_MODES.STATIC);
        const result = await consumeTokenStream(
          streamFallbackChat({ prompt, chatMessages, maxTokens: max_tokens }),
          onToken,
        );
        return persistMemory(result);
      } catch {
        throw new Error(friendlyAIError(error));
      }
    }
  }, [mode, modeReady, refreshMode]);

  const clearMemory = useCallback(() => {
    ownaiMemory.clear();
    setMemoryFacts({});
  }, []);

  return {
    mode,
    modeLabel: getModeLabel(mode),
    modeReady,
    refreshMode,
    send,
    friendlyAIError,
    taskMode,
    activeModel,
    memoryFacts,
    clearMemory,
  };
}
