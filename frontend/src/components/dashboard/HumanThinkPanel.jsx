import { useCallback, useEffect, useRef, useState } from 'react';
import { thinkMessage } from '../../api/client.js';

const MAX_MEMORY = 5;

function system1Match(input) {
  const patterns = [
    { regex: /hello|hi|hey/i, reply: 'Hey! What are we building today?', confidence: 95 },
    { regex: /why|explain/i, reply: null, confidence: 60 },
    { regex: /how do i|how to/i, reply: null, confidence: 55 },
    { regex: /fix|bug|error/i, reply: null, confidence: 50 },
    { regex: /code|write|build/i, reply: null, confidence: 65 },
  ];
  for (const p of patterns) {
    if (p.regex.test(input)) return { reply: p.reply, confidence: p.confidence };
  }
  return { reply: null, confidence: 45 };
}

function confidenceTone(level) {
  if (level >= 90) return { chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30', label: 'System 1 - High Confidence' };
  if (level >= 70) return { chip: 'bg-amber-500/15 text-amber-300 border-amber-400/30', label: 'System 1 -> System 2 - Checking' };
  if (level >= 50) return { chip: 'bg-orange-500/15 text-orange-300 border-orange-400/30', label: 'System 2 - Deep Reasoning' };
  return { chip: 'bg-rose-500/15 text-rose-300 border-rose-400/30', label: 'System 2 - Needs Clarification' };
}

function ConfidenceBadge({ level }) {
  const tone = confidenceTone(level);
  return (
    <span className={`mb-1 inline-flex rounded-full border px-2 py-0.5 font-mono text-[10px] ${tone.chip}`}>
      {tone.label} · {level}%
    </span>
  );
}

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-2 w-2 animate-pulse rounded-full bg-violet-400" />
      <span className="h-2 w-2 animate-pulse rounded-full bg-violet-400 [animation-delay:0.15s]" />
      <span className="h-2 w-2 animate-pulse rounded-full bg-violet-400 [animation-delay:0.3s]" />
    </span>
  );
}

function RunModal({ open, lines, onClose }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="w-full max-w-2xl rounded-2xl border border-violet-400/30 bg-[#080814] p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-mono text-xs uppercase tracking-wider text-violet-300">OWN AI - Run Output</p>
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 rounded-md bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            ×
          </button>
        </div>
        <div className="max-h-[55vh] overflow-auto rounded-xl border border-white/10 bg-[#03030a] p-4 font-mono text-xs leading-relaxed">
          {lines.length ? (
            lines.map((line, i) => (
              <div
                key={`${line.type}-${i}`}
                className={
                  line.type === 'err'
                    ? 'text-rose-400'
                    : line.type === 'warn'
                      ? 'text-amber-300'
                      : line.type === 'info'
                        ? 'text-violet-300'
                        : 'text-slate-100'
                }
              >
                {line.text}
              </div>
            ))
          ) : (
            <div className="text-violet-300">// No output</div>
          )}
        </div>
      </div>
    </div>
  );
}

function CodeToolbar({ code, language = 'txt' }) {
  const [copied, setCopied] = useState(false);
  const [runOpen, setRunOpen] = useState(false);
  const [runLines, setRunLines] = useState([]);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore clipboard failure
    }
  }, [code]);

  const download = useCallback(() => {
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ownai-output.${language || 'txt'}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [code, language]);

  const run = useCallback(() => {
    const lang = (language || '').toLowerCase();
    if (!['js', 'javascript', 'mjs', 'cjs'].includes(lang)) {
      setRunLines([{ type: 'info', text: `Run supports JavaScript only. Current language: ${lang || 'plain'}` }]);
      setRunOpen(true);
      return;
    }
    const logs = [];
    const fakeConsole = {
      log: (...a) => logs.push({ type: 'out', text: a.map(String).join(' ') }),
      error: (...a) => logs.push({ type: 'err', text: `❌ ${a.map(String).join(' ')}` }),
      warn: (...a) => logs.push({ type: 'warn', text: `⚠ ${a.map(String).join(' ')}` }),
      info: (...a) => logs.push({ type: 'info', text: `ℹ ${a.map(String).join(' ')}` }),
    };
    try {
      const fn = new Function('console', code);
      fn(fakeConsole);
      setRunLines(logs.length ? logs : [{ type: 'info', text: '// No console output.' }]);
    } catch (e) {
      setRunLines([{ type: 'err', text: `Error: ${e.message}` }]);
    }
    setRunOpen(true);
  }, [code, language]);

  return (
    <>
      <div className="flex items-center gap-0.5 border-b border-white/10 bg-[#0e0e20] p-1.5">
        <button type="button" onClick={copy} className="rounded px-2 py-1 text-[11px] text-slate-400 hover:bg-white/10 hover:text-slate-100">
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <button type="button" onClick={download} className="rounded px-2 py-1 text-[11px] text-slate-400 hover:bg-white/10 hover:text-slate-100">
          Download
        </button>
        <span className="mx-1 h-4 w-px bg-white/10" />
        <button type="button" onClick={run} className="rounded px-2 py-1 text-[11px] text-violet-300 hover:bg-violet-500/15 hover:text-violet-200">
          Run
        </button>
      </div>
      <RunModal open={runOpen} lines={runLines} onClose={() => setRunOpen(false)} />
    </>
  );
}

function ContentWithCode({ text }) {
  const parts = String(text || '').split(/(```[\w-]*\n[\s\S]*?```)/g);
  return (
    <div className="space-y-2">
      {parts.map((part, i) => {
        const m = part.match(/^```([\w-]*)\n([\s\S]*?)```$/);
        if (!m) {
          return (
            <p key={i} className="whitespace-pre-wrap">
              {part}
            </p>
          );
        }
        const lang = m[1] || 'txt';
        const code = m[2];
        return (
          <div key={i} className="overflow-hidden rounded-xl border border-violet-400/25 bg-[#050510]">
            <CodeToolbar code={code} language={lang} />
            <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-violet-200">
              <code>{code}</code>
            </pre>
          </div>
        );
      })}
    </div>
  );
}

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`mb-4 flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[78%]">
        {!isUser && typeof msg.confidence === 'number' && <ConfidenceBadge level={msg.confidence} />}
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? 'rounded-br-md bg-gradient-to-br from-violet-600 to-violet-700 text-white'
              : 'rounded-bl-md border border-white/10 bg-white/5 text-slate-100'
          }`}
        >
          {isUser ? msg.content : <ContentWithCode text={msg.content} />}
        </div>
        {!isUser && msg.process && (
          <p className="mt-1 px-1 font-mono text-[11px] text-slate-400">↳ {msg.process}</p>
        )}
      </div>
    </div>
  );
}

export default function HumanThinkPanel() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hey - I'm your OWN AI Human Think mode.\nI reason in two speeds: quick instinct + deliberate reflection.",
      confidence: 99,
      process: 'Cold start greeting - System 1',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  function buildContext(msgs) {
    return msgs.slice(-MAX_MEMORY).map((m) => ({ role: m.role, content: m.content }));
  }

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    setError('');

    const userMsg = { role: 'user', content: trimmed };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    const { confidence, reply: s1Reply } = system1Match(trimmed);

    try {
      if (s1Reply) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: s1Reply,
            confidence,
            process: 'System 1 - fast pattern response',
          },
        ]);
        return;
      }

      const result = await thinkMessage({
        message: trimmed,
        mode: 'human_think',
        stream: false,
        context: {
          score_confidence: true,
          working_memory: buildContext(newMessages),
        },
        use_extended_thinking: confidence < 70,
      });

      const processLabel = confidence >= 90
        ? 'System 1 - pattern matched instantly'
        : confidence >= 70
          ? 'System 1 -> System 2 - validated instinct'
          : 'System 2 - deliberate reasoning engaged';

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: result.final_answer || 'No response received.',
          confidence: Math.max(confidence, result.confidence || 72),
          process: processLabel,
        },
      ]);
    } catch (e) {
      setError(e.message || 'Network error');
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Could not run Human Think right now. Check backend/API settings.',
          confidence: 0,
          process: 'System 2 - error handling',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full min-h-[70vh] flex-col rounded-2xl border border-slate-700 bg-[#0a0a0f] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-100">Human Think</h2>
          <p className="font-mono text-xs text-slate-400">
            Dual-process cognition · Working Memory: {Math.min(messages.length, MAX_MEMORY)} / {MAX_MEMORY}
          </p>
          <div className="mt-2 h-1.5 w-44 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-300 transition-all"
              style={{ width: `${(Math.min(messages.length, MAX_MEMORY) / MAX_MEMORY) * 100}%` }}
            />
          </div>
        </div>
        <div className="flex gap-1">
          <span className="rounded-md border border-violet-400/30 bg-violet-500/15 px-2 py-0.5 font-mono text-[10px] text-violet-300">System 1</span>
          <span className="rounded-md border border-violet-400/30 bg-violet-500/15 px-2 py-0.5 font-mono text-[10px] text-violet-300">System 2</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {messages.map((msg, i) => (
          <MessageBubble key={`${msg.role}-${i}`} msg={msg} />
        ))}
        {loading && (
          <div className="mb-4 rounded-2xl rounded-bl-md border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
            <ThinkingDots />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
        <textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Ask me to build, fix, or explain anything..."
          className="w-full resize-none bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
        />
        <div className="mt-2 flex items-center justify-between">
          <p className="font-mono text-[11px] text-slate-500">Enter to send · Shift+Enter new line</p>
          <button
            type="button"
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="h-9 rounded-lg bg-gradient-to-br from-violet-600 to-violet-700 px-3 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
      </div>
    </div>
  );
}
