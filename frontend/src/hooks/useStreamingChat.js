import { useState, useCallback } from 'react';
import { generateText, queryRag } from '../api/client.js';
import { streamOllamaChat, resolveOllamaModel } from '../utils/ollamaClient.js';
import { streamPromptResponse } from '../utils/promptEngine.js';
import { buildChatMessages, resolveHistory } from '../utils/memory.js';
import ownaiMemory from '../utils/ownaiMemory.js';
import { detectTask } from '../utils/modelRouter.js';
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

async function streamBackendSse(response, onToken) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data);
        if (parsed.token) {
          accumulated += parsed.token;
          onToken?.(accumulated, parsed.token);
        }
      } catch {
        // skip
      }
    }
  }
  return accumulated;
}

/**
 * Premium streaming chat hook — model routing, memory, RAG, token streaming.
 */
export default function useStreamingChat() {
  const [tokens, setTokens] = useState('');
  const [thinking, setThinking] = useState(false);
  const [activeModel, setActiveModel] = useState('llama3.1:8b');
  const [activeMode, setActiveMode] = useState('FAST MODE');
  const [memoryFacts, setMemoryFacts] = useState(() => ownaiMemory.getFacts());

  const sendMessage = useCallback(async ({
    message,
    history = [],
    onToken,
    temperature = 0.7,
    max_tokens = 512,
    model_key,
    algorithm_id,
    useRag = true,
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

    const persist = (content) => {
      ownaiMemory.remember('user', prompt);
      ownaiMemory.remember('assistant', content);
      setMemoryFacts(ownaiMemory.getFacts());
      return { content, model: modelLabel, mode: task.mode };
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
        const backendResponse = await generateText({
          prompt,
          messages: resolvedHistory,
          max_tokens,
          temperature,
          model_key,
          algorithm_id,
          stream: true,
          use_rag: useRag,
        });
        const content = await streamBackendSse(backendResponse, handleToken);
        return persist(content);
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
