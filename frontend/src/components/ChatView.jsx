import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble.jsx';
import PromptInput from './dashboard/PromptInput.jsx';
import DocumentUpload from './DocumentUpload.jsx';
import { getOwnaiSessionId } from '../utils/sessionId.js';

export default function ChatView({
  session,
  loading,
  input,
  onInputChange,
  onSubmit,
  engines,
  selectedEngine,
  onEngineChange,
  attachments,
  onAttach,
  onRemoveAttachment,
  uploading,
  thinkingMode,
  onThinkingModeChange,
  onVoiceTranscript,
  sessionId,
  onDocumentUploaded,
  backendReady,
}) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages, loading]);

  if (!session) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 border-b border-stone-200 px-6 py-3 dark:border-slate-800">
        <h2 className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
          {session.title || 'New conversation'}
        </h2>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-3xl space-y-4">
          {session.messages.map((msg, i) => (
            <MessageBubble
              key={`${msg.timestamp || i}-${i}`}
              role={msg.role}
              content={msg.content}
              isStreaming={msg.streaming}
              thinking={msg.thinking}
              thinkingResult={msg.thinkingResult}
              reasoningMode={msg.reasoningMode}
              modeReason={msg.modeReason}
              autoDetected={msg.autoDetected}
              confidence={msg.confidence}
              confidenceDetail={msg.confidenceDetail}
            />
          ))}
          {loading && session.messages.length > 0 && !session.messages.at(-1)?.streaming && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                <span className="inline-flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-teal-500 [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-teal-500 [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-teal-500" />
                </span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <div className="shrink-0 border-t border-stone-200 bg-[#f7f6f3]/95 px-4 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto mb-2 flex max-w-2xl justify-center">
          <DocumentUpload
            sessionId={sessionId || getOwnaiSessionId()}
            onUploaded={onDocumentUploaded}
          />
        </div>
        <PromptInput
          value={input}
          onChange={onInputChange}
          onSubmit={onSubmit}
          loading={loading}
          placeholder="Reply to OWNAI…"
          engines={engines}
          selectedEngine={selectedEngine}
          onEngineChange={onEngineChange}
          attachments={attachments}
          onAttach={onAttach}
          onRemoveAttachment={onRemoveAttachment}
          uploading={uploading}
          onVoiceTranscript={onVoiceTranscript}
          thinkingMode={thinkingMode}
          onThinkingModeChange={onThinkingModeChange}
          attachDisabled={!backendReady}
          attachHint="Upload unavailable — try again shortly"
        />
      </div>
    </div>
  );
}
