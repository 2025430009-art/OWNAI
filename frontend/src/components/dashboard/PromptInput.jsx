import { useRef, useState, useCallback } from 'react';
import { AttachIcon, MicIcon, SendIcon } from './DashboardIcons.jsx';
import { VoiceInput, isVoiceSupported } from '../../utils/voice.js';
import ResearchTemplatesMenu from '../ResearchTemplatesMenu.jsx';
import ThinkingModeSelector from './ThinkingModeSelector.jsx';

const ACCEPTED_TYPES = [
  '.txt', '.md', '.json', '.csv', '.js', '.jsx', '.ts', '.tsx',
  '.py', '.sql', '.html', '.css', '.sh', '.pdf', '.docx',
  '.png', '.jpg', '.jpeg', '.webp', '.gif',
].join(',');

export default function PromptInput({
  value,
  onChange,
  onSubmit,
  loading,
  placeholder = 'How can OWNAI help you today?',
  engines = [],
  selectedEngine,
  onEngineChange,
  attachments = [],
  onAttach,
  onRemoveAttachment,
  uploading = false,
  disabled = false,
  attachDisabled = false,
  attachHint = 'Attach file',
  onVoiceTranscript,
  onTemplateSelect,
  showResearchTemplates = false,
  thinkingMode = 'auto',
  onThinkingModeChange,
}) {
  const fileInputRef = useRef(null);
  const [listening, setListening] = useState(false);
  const voiceRef = useRef(null);
  const active = engines.find((e) => e.key === selectedEngine);

  const toggleVoice = useCallback(() => {
    if (!isVoiceSupported()) return;
    if (!voiceRef.current) {
      voiceRef.current = new VoiceInput(
        (text) => {
          setListening(false);
          onVoiceTranscript?.(text);
        },
        () => setListening(false),
      );
    }
    if (listening) {
      voiceRef.current.stop();
      setListening(false);
    } else {
      setListening(voiceRef.current.start());
    }
  }, [listening, onVoiceTranscript]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length && onAttach) onAttach(files);
    e.target.value = '';
  };

  const canSend = value.trim() || attachments.length > 0;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED_TYPES}
        className="hidden"
        onChange={handleFileChange}
        aria-hidden="true"
        tabIndex={-1}
      />
      <div className="rounded-2xl border border-stone-200 bg-white shadow-[0_4px_24px_rgba(15,23,42,0.06)] transition-shadow focus-within:border-teal-300 focus-within:shadow-[0_8px_32px_rgba(13,148,136,0.12)] dark:border-slate-700 dark:bg-slate-900 dark:focus-within:border-teal-700">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pt-3">
            {attachments.map((file) => (
              <span
                key={file.id}
                className="inline-flex max-w-full items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
              >
                <span className="truncate">{file.originalName}</span>
                <button
                  type="button"
                  onClick={() => onRemoveAttachment?.(file.id)}
                  className="text-slate-400 hover:text-slate-600"
                  aria-label={`Remove ${file.originalName}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={3}
          disabled={loading || uploading || disabled}
          className="w-full resize-none bg-transparent px-4 pt-4 text-[15px] leading-relaxed text-slate-800 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
        />
        <div className="flex items-center justify-end gap-2 px-3 pb-1">
          <ThinkingModeSelector
            value={thinkingMode}
            onChange={onThinkingModeChange}
            disabled={loading || uploading || disabled}
          />
        </div>
        <div className="flex items-center gap-2 px-3 pb-3">
          {showResearchTemplates && (
            <ResearchTemplatesMenu
              disabled={loading || uploading || disabled}
              onSelect={onTemplateSelect}
            />
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || uploading || disabled || attachDisabled}
            className="rounded-lg p-2 text-slate-400 hover:bg-stone-100 hover:text-slate-600 disabled:opacity-40 dark:hover:bg-slate-800"
            aria-label="Attach file"
            title={attachDisabled ? attachHint : 'Attach file'}
          >
            <AttachIcon />
          </button>
          {uploading && (
            <span className="text-xs text-slate-400">Uploading…</span>
          )}
          <div className="grow" />
          {engines.length > 0 && (
            <select
              value={selectedEngine}
              onChange={(e) => onEngineChange(e.target.value)}
              title={active?.description || ''}
              className="max-w-[11rem] truncate rounded-lg border border-teal-200/60 bg-stone-100 px-2.5 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-teal-800 dark:bg-slate-800 dark:text-slate-300"
            >
              {engines.map((engine) => (
                <option key={engine.key} value={engine.key}>
                  {engine.type === 'algorithm' ? `✦ ${engine.name}` : engine.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={toggleVoice}
            disabled={loading || uploading || disabled || !isVoiceSupported()}
            className={`rounded-lg p-2 transition-colors ${
              listening
                ? 'bg-red-100 text-red-600 animate-pulse'
                : 'text-slate-400 hover:bg-stone-100 hover:text-slate-600 dark:hover:bg-slate-800'
            }`}
            aria-label="Voice input"
            title={isVoiceSupported() ? 'Voice input' : 'Voice not supported'}
          >
            <MicIcon />
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={loading || uploading || disabled || !canSend}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 text-white transition-colors hover:bg-teal-700 disabled:opacity-40"
            aria-label="Send message"
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
