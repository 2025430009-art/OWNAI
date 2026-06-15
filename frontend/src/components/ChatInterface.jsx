import { useState, useRef, useEffect } from 'react';
import MessageBubble from './MessageBubble.jsx';
import ModelSelector from './ModelSelector.jsx';
import { generateText } from '../api/client.js';

const DEFAULT_MODELS = [
  { key: 'default', name: 'Llama 3.2 1B Instruct Q4', src: 'LLAMA_3_2_1B_INST_Q4_0' },
];

export default function ChatInterface({ models = DEFAULT_MODELS }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I\'m your AI assistant powered by QVAC. How can I help you today?' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(models[0]?.key || 'default');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(256);
  const [useStreaming, setUseStreaming] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      if (useStreaming) {
        setMessages((prev) => [...prev, { role: 'assistant', content: '', streaming: true }]);
        const response = await generateText({
          prompt: userMessage,
          max_tokens: maxTokens,
          temperature,
          model_key: selectedModel,
          stream: true,
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                accumulated += parsed.token || '';
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: 'assistant',
                    content: accumulated,
                    streaming: true,
                  };
                  return updated;
                });
              } catch {
                // skip malformed SSE chunks
              }
            }
          }
        }

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: accumulated };
          return updated;
        });
      } else {
        const result = await generateText({
          prompt: userMessage,
          max_tokens: maxTokens,
          temperature,
          model_key: selectedModel,
          stream: false,
        });
        setMessages((prev) => [...prev, { role: 'assistant', content: result.output }]);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev.filter((m) => !m.streaming),
        { role: 'assistant', content: `Error: ${error.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Playground</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Interactive chat powered by QVAC LLM inference.
      </p>
      <div className="mt-6 flex gap-6 h-[calc(100vh-14rem)]">
      <aside className="hidden lg:block w-64 shrink-0">
        <ModelSelector
          models={models}
          selected={selectedModel}
          onChange={setSelectedModel}
          temperature={temperature}
          onTemperatureChange={setTemperature}
          maxTokens={maxTokens}
          onMaxTokensChange={setMaxTokens}
        />
        <label className="flex items-center gap-2 mt-4 text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={useStreaming}
            onChange={(e) => setUseStreaming(e.target.checked)}
            className="accent-teal-600"
          />
          Stream responses
        </label>
      </aside>

      <div className="flex-1 flex flex-col card overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <MessageBubble
              key={i}
              role={msg.role}
              content={msg.content}
              isStreaming={msg.streaming}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="border-t border-slate-200 p-4 dark:border-slate-700">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="input-field flex-1"
              disabled={loading}
            />
            <button type="submit" disabled={loading || !input.trim()} className="btn-primary px-6">
              {loading ? '...' : 'Send'}
            </button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
}