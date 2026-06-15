import { useState, useCallback } from 'react';
import FormattedText from './FormattedText.jsx';

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }, [text]);

  if (!text?.trim()) return null;

  return (
    <button
      type="button"
      onClick={copy}
      className="rounded px-2 py-0.5 text-[10px] text-slate-400 transition-colors hover:bg-stone-100 hover:text-slate-600 dark:hover:bg-slate-700"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

const MODE_COLORS = {
  'FAST MODE': 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  'THINK MODE': 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300',
  'DEEP MODE': 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
  'CREATE MODE': 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
};

export default function MessageBubble({
  role,
  content,
  isStreaming,
  mode,
  model,
  onSpeak,
}) {
  const isUser = role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[92%] sm:max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
          isUser
            ? 'rounded-br-md bg-gradient-to-br from-teal-600 to-teal-700 text-white'
            : 'rounded-bl-md border border-stone-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
        }`}
      >
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <p className={`text-xs font-medium ${isUser ? 'text-teal-100' : 'text-slate-500 dark:text-slate-400'}`}>
            {isUser ? 'You' : 'OWNAI'}
          </p>
          {!isUser && mode && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${MODE_COLORS[mode] || MODE_COLORS['FAST MODE']}`}>
              {mode}
            </span>
          )}
          {!isUser && model && (
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-slate-700 dark:text-slate-400">
              {model}
            </span>
          )}
          {!isUser && <CopyButton text={content} />}
          {!isUser && onSpeak && (
            <button
              type="button"
              onClick={onSpeak}
              className="rounded px-2 py-0.5 text-[10px] text-slate-400 hover:bg-stone-100 dark:hover:bg-slate-700"
              title="Read aloud"
            >
              Speak
            </button>
          )}
        </div>
        <div className={`text-sm leading-relaxed ${isUser ? 'whitespace-pre-wrap' : ''}`}>
          {isUser ? content : <FormattedText text={content} />}
          {isStreaming && (
            <span className="ml-1 inline-flex items-center gap-0.5 align-middle">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-400" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-400 [animation-delay:0.15s]" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-400 [animation-delay:0.3s]" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
