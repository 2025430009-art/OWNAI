import { useState, useRef } from 'react';
import DocumentUpload from './DocumentUpload.jsx';
import { getOwnaiSessionId } from '../utils/sessionId.js';

export const PILLS = ['Write', 'Learn', 'Code', 'Life stuff', "OWNAI's choice"];

export const PILL_PROMPTS = {
  Write: 'Help me write something — a message, email, or story.',
  Learn: 'Teach me something interesting today.',
  Code: 'Help me with a coding problem.',
  'Life stuff': 'Give me life advice or help me think through something.',
  "OWNAI's choice": 'Surprise me with something interesting.',
};

function timeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeView({
  onSend,
  username,
  sessionId,
  onDocumentUploaded,
  loading = false,
}) {
  const [input, setInput] = useState('');
  const inputRef = useRef(null);
  const greeting = timeGreeting();
  const name = username || 'there';

  const submit = (text) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput('');
    onSend(msg);
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 pb-8 pt-[10vh]">
      <h1 className="mb-10 flex items-center gap-2 text-center text-3xl font-medium tracking-tight text-slate-800 dark:text-white sm:text-4xl">
        <span className="text-teal-600" aria-hidden="true">✳</span>
        {greeting}, {name}
      </h1>

      <div className="w-full max-w-2xl">
        <div className="rounded-2xl border border-stone-200 bg-white shadow-[0_4px_24px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-900">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="How can OWNAI help you today?"
            rows={3}
            disabled={loading}
            className="w-full resize-none bg-transparent px-4 pt-4 text-[15px] leading-relaxed text-slate-800 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
          />
          <div className="flex items-center justify-between gap-2 px-3 pb-3">
            <DocumentUpload
              sessionId={sessionId || getOwnaiSessionId()}
              onUploaded={onDocumentUploaded}
            />
            <button
              type="button"
              onClick={() => submit()}
              disabled={loading || !input.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600 text-white transition-colors hover:bg-teal-700 disabled:opacity-40"
              aria-label="Send"
            >
              ↑
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 flex max-w-2xl flex-wrap justify-center gap-2">
        {PILLS.map((pill) => (
          <button
            key={pill}
            type="button"
            onClick={() => submit(PILL_PROMPTS[pill])}
            disabled={loading}
            className="rounded-full border border-stone-200 bg-white px-4 py-2 text-[13px] text-slate-700 transition-colors hover:border-teal-200 hover:bg-teal-50 hover:text-teal-900 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-teal-800 dark:hover:bg-teal-950/40"
          >
            {pill}
          </button>
        ))}
      </div>
    </div>
  );
}
