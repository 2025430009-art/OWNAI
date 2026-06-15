import { useState, useRef, useEffect, useCallback } from 'react';
import MessageBubble from './MessageBubble.jsx';
import ModelSelector from './ModelSelector.jsx';
import useStreamingChat from '../hooks/useStreamingChat.js';
import { getSessionContext } from '../utils/memory.js';
import ownaiMemory from '../utils/ownaiMemory.js';
import { VoiceInput, VoiceOutput, isVoiceSupported } from '../utils/voice.js';
import { detectAIMode, getModeLabel } from '../utils/apiConfig.js';

const DEFAULT_MODELS = [
  { key: 'default', name: 'Llama 3.2 1B Instruct Q4', src: 'LLAMA_3_2_1B_INST_Q4_0' },
];

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1 px-1">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-500 [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-500 [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-500" />
    </span>
  );
}

export default function ChatInterface({ models = DEFAULT_MODELS }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I\'m **OWNAI v2**. How can I help you today?' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(models[0]?.key || 'default');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(512);
  const [listening, setListening] = useState(false);
  const [platformMode, setPlatformMode] = useState('');
  const messagesEndRef = useRef(null);
  const voiceInputRef = useRef(null);
  const voiceOutRef = useRef(new VoiceOutput());

  const {
    thinking,
    activeModel,
    activeMode,
    sendMessage,
    clearMemory,
    memoryFacts,
  } = useStreamingChat();

  useEffect(() => {
    detectAIMode().then((m) => setPlatformMode(getModeLabel(m)));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  useEffect(() => {
    if (!isVoiceSupported()) return;
    voiceInputRef.current = new VoiceInput(
      (transcript) => {
        setInput(transcript);
        setListening(false);
      },
      () => setListening(false),
    );
  }, []);

  const toggleVoice = () => {
    if (!voiceInputRef.current?.supported) return;
    if (listening) {
      voiceInputRef.current.stop();
      setListening(false);
    } else {
      setListening(voiceInputRef.current.start());
    }
  };

  const runSend = useCallback(async (userMessage, { regenerate = false } = {}) => {
    if (!userMessage.trim() || loading) return;

    const history = regenerate
      ? getSessionContext(messages.filter((m) => !m.streaming).slice(0, -1))
      : getSessionContext(messages.filter((m) => !m.streaming));

    if (!regenerate) {
      setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    }
    setLoading(true);
    setMessages((prev) => {
      const base = regenerate ? prev.slice(0, -1) : prev;
      return [...base, { role: 'assistant', content: '', streaming: true, mode: activeMode, model: activeModel }];
    });

    try {
      const result = await sendMessage({
        message: userMessage,
        history,
        max_tokens: maxTokens,
        temperature,
        model_key: selectedModel,
        onToken: (full) => {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            updated[updated.length - 1] = {
              ...last,
              role: 'assistant',
              content: full,
              streaming: true,
            };
            return updated;
          });
        },
      });

      const content = result?.content ?? '';
      const mode = result?.mode ?? activeMode;
      const model = result?.model ?? activeModel;

      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content,
          mode,
          model,
        };
        return updated;
      });
    } catch (error) {
      setMessages((prev) => [
        ...prev.filter((m) => !m.streaming),
        { role: 'assistant', content: `Sorry, something went wrong: ${error.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  }, [loading, messages, sendMessage, maxTokens, temperature, selectedModel, activeMode, activeModel]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const userMessage = input.trim();
    if (!userMessage) return;
    setInput('');
    await runSend(userMessage);
  };

  const handleRegenerate = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUser) runSend(lastUser.content, { regenerate: true });
  };

  const memorySummary = [
    memoryFacts.name && `Name: ${memoryFacts.name}`,
    memoryFacts.role && `Role: ${memoryFacts.role}`,
    memoryFacts.project && `Project: ${memoryFacts.project}`,
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">OWNAI Playground</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {platformMode ? `Platform: ${platformMode}` : 'Ollama · backend · offline'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeMode && (
            <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800 dark:border-teal-800 dark:bg-teal-950/50 dark:text-teal-300">
              {activeMode}
            </span>
          )}
          {activeModel && (
            <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {activeModel}
            </span>
          )}
          {memorySummary.length > 0 && (
            <span
              className="max-w-xs truncate rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
              title={memorySummary.join(' · ')}
            >
              Remembers: {memorySummary.join(' · ')}
            </span>
          )}
        </div>
      </div>

      <div className="mt-6 flex h-[calc(100vh-13rem)] gap-4 sm:gap-6">
        <aside className="hidden w-64 shrink-0 lg:block">
          <ModelSelector
            models={models}
            selected={selectedModel}
            onChange={setSelectedModel}
            temperature={temperature}
            onTemperatureChange={setTemperature}
            maxTokens={maxTokens}
            onMaxTokensChange={setMaxTokens}
          />
          <div className="mt-4 space-y-2 rounded-xl border border-stone-200 p-3 dark:border-slate-700">
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={loading || messages.length < 2}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-xs text-slate-600 hover:bg-stone-50 disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Regenerate last response
            </button>
            <button
              type="button"
              onClick={() => { clearMemory(); ownaiMemory.clear(); }}
              className="w-full rounded-lg border border-red-200 px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              Clear memory
            </button>
          </div>
        </aside>

        <div className="card flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.map((msg, i) => (
              <MessageBubble
                key={i}
                role={msg.role}
                content={msg.content}
                isStreaming={msg.streaming}
                mode={msg.mode}
                model={msg.model}
                onSpeak={msg.role === 'assistant' && !msg.streaming
                  ? () => voiceOutRef.current.speak(msg.content)
                  : undefined}
              />
            ))}
            {thinking && !messages.at(-1)?.streaming && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md border border-stone-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                  <p className="mb-1 text-xs text-slate-400">OWNAI is thinking</p>
                  <ThinkingDots />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="border-t border-stone-200 p-4 dark:border-slate-700">
            <div className="flex gap-2 sm:gap-3">
              <button
                type="button"
                onClick={toggleVoice}
                disabled={loading || !isVoiceSupported()}
                className={`rounded-lg p-2.5 transition-colors ${
                  listening
                    ? 'bg-red-100 text-red-600 animate-pulse'
                    : 'text-slate-400 hover:bg-stone-100 hover:text-slate-600 dark:hover:bg-slate-800'
                }`}
                aria-label="Voice input"
                title={isVoiceSupported() ? 'Voice input' : 'Voice not supported in this browser'}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 14a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-14 0M12 18v3" />
                </svg>
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={listening ? 'Listening…' : 'Ask OWNAI anything…'}
                className="input-field flex-1"
                disabled={loading}
              />
              <button type="submit" disabled={loading || !input.trim()} className="btn-primary px-5 sm:px-6">
                {loading ? <ThinkingDots /> : 'Send'}
              </button>
            </div>
            {listening && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex h-6 items-end gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span
                      key={n}
                      className="w-1 rounded-full bg-teal-500 animate-pulse"
                      style={{ height: `${8 + n * 4}px`, animationDelay: `${n * 0.1}s` }}
                    />
                  ))}
                </div>
                <span className="text-xs text-teal-600 dark:text-teal-400">Listening… say &quot;Hey OWNAI&quot; or speak your message</span>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
