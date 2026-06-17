import { useState, useCallback } from 'react';
import FormattedText from './FormattedText.jsx';
import ResearchActionButtons from './ResearchActionButtons.jsx';
import ThinkingVisualizer from './ThinkingVisualizer.jsx';
import ConfidenceDisplay from './dashboard/ConfidenceDisplay.jsx';
import { parseThinkingResult, shouldShowThinkingVisualizer } from '../utils/parseThinkingResult.js';
import { MODE_LABELS } from '../constants/thinkingModes.js';
import { ENABLE_REASONING } from '../config/inference.js';

function ModeAutoTag({ reasoningMode, modeReason, autoDetected }) {
  if (!reasoningMode || reasoningMode === 'direct') return null;
  const label = MODE_LABELS[reasoningMode] || reasoningMode;
  const reason = modeReason || (autoDetected ? 'auto-selected for this question' : '');
  return (
    <div className="mb-2 inline-flex flex-wrap items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[10px] text-violet-800 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-200">
      <span>Using: {label}</span>
      {reason && (
        <>
          <span className="text-violet-400">•</span>
          <span className="text-violet-600 dark:text-violet-300">because: {reason}</span>
        </>
      )}
    </div>
  );
}

function ThinkingBlock({
  thinking,
  thinkingResult,
  reasoningMode,
  modeReason,
  autoDetected,
  confidence,
  confidenceDetail,
  content,
  isStreaming,
}) {
  if (!ENABLE_REASONING) return null;

  const [showReasoning, setShowReasoning] = useState(false);
  const [scratchpadOpen, setScratchpadOpen] = useState(true);

  const parsed = parseThinkingResult({
    thinking,
    thinkingResult,
    meta: { reasoning_mode: reasoningMode },
    confidence,
    content,
  });

  const showVisualizer = shouldShowThinkingVisualizer(parsed, reasoningMode);

  if (showVisualizer) {
    return (
      <div className="mb-3">
        <ModeAutoTag
          reasoningMode={reasoningMode || parsed?.thinking_mode}
          modeReason={modeReason}
          autoDetected={autoDetected}
        />
        <ThinkingVisualizer
          thinkingResult={parsed}
          isStreaming={isStreaming}
          hideFinalAnswer
          collapsed={!showReasoning}
        />
        {!isStreaming && (
          <button
            type="button"
            onClick={() => setShowReasoning((v) => !v)}
            className="mt-1 text-[11px] font-medium text-teal-700 hover:text-teal-900 dark:text-teal-400 dark:hover:text-teal-300"
          >
            {showReasoning ? 'Hide reasoning' : 'Show reasoning'}
          </button>
        )}
      </div>
    );
  }

  if (!thinking?.trim()) return null;

  return (
    <div className="mb-3 rounded-lg border border-violet-200 bg-violet-50/70 dark:border-violet-900 dark:bg-violet-950/20">
      <button
        type="button"
        onClick={() => setScratchpadOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-[11px] font-medium text-violet-800 dark:text-violet-200"
      >
        <span>{isStreaming ? 'Extended thinking…' : 'View reasoning scratchpad'}</span>
        <span>{scratchpadOpen ? '▾' : '▸'}</span>
      </button>
      {scratchpadOpen && (
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap border-t border-violet-200 px-3 py-2 text-[11px] text-violet-900 dark:border-violet-900 dark:text-violet-100">
          {thinking}
        </pre>
      )}
    </div>
  );
}

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
  researchProjectId,
  thinking,
  thinkingResult,
  reasoningMode,
  modeReason,
  autoDetected,
  confidence,
  confidenceDetail,
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
          {!isUser && (
            <ThinkingBlock
              thinking={thinking}
              thinkingResult={thinkingResult}
              reasoningMode={reasoningMode}
              modeReason={modeReason}
              autoDetected={autoDetected}
              confidence={confidence}
              confidenceDetail={confidenceDetail}
              content={content}
              isStreaming={isStreaming}
            />
          )}
          {isUser ? content : <FormattedText text={content} />}
          {!isUser && !isStreaming && (
            <ConfidenceDisplay confidence={confidence} confidenceDetail={confidenceDetail} />
          )}
          {isStreaming && (
            <span className="ml-1 inline-flex items-center gap-0.5 align-middle">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-400" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-400 [animation-delay:0.15s]" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-400 [animation-delay:0.3s]" />
            </span>
          )}
        </div>
        {!isUser && (
          <ResearchActionButtons
            content={content}
            projectId={researchProjectId}
            isStreaming={isStreaming}
          />
        )}
      </div>
    </div>
  );
}
