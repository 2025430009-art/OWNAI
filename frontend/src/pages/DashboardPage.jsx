import { useState, useCallback, useRef, useEffect } from 'react';
import DashboardSidebar from '../components/dashboard/DashboardSidebar.jsx';
import WelcomePanel from '../components/dashboard/WelcomePanel.jsx';
import ChatPanel from '../components/dashboard/ChatPanel.jsx';
import PromptInput from '../components/dashboard/PromptInput.jsx';
import SectionPanel from '../components/dashboard/SectionPanel.jsx';
import useChatSessions from '../hooks/useChatSessions.js';
import { uploadAttachments, deleteAttachment, listAIEngines, ingestRagDocument } from '../api/client.js';
import useAI from '../hooks/useAI.js';
import BackendConnectPanel from '../components/dashboard/BackendConnectPanel.jsx';
import { getSessionContext } from '../utils/memory.js';
import { FALLBACK_ENGINES, resolveEngine } from '../utils/aiEngines.js';

const DEFAULT_ENGINES = FALLBACK_ENGINES;

export default function DashboardPage({
  models,
  user,
  onSignIn,
  theme,
  onToggleTheme,
}) {
  const {
    sessions,
    activeId,
    activeSession,
    createSession,
    selectSession,
    deleteSession,
    appendMessage,
    updateLastMessage,
    replaceLastAssistant,
    removeStreamingPlaceholder,
  } = useChatSessions();

  const [activeSection, setActiveSection] = useState('chat');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [engines, setEngines] = useState(models?.length ? models : DEFAULT_ENGINES);
  const [selectedEngine, setSelectedEngine] = useState(
    () => localStorage.getItem('ownai-selected-engine') || DEFAULT_ENGINES[0].key,
  );
  const [temperature, setTemperature] = useState(0.7);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const chatEndRef = useRef(null);
  const saveToReferenceRef = useRef(null);
  const { send: sendAI, friendlyAIError, modeLabel, taskMode, activeModel, memoryFacts, clearMemory } = useAI();

  const userName = user?.email?.split('@')[0];

  useEffect(() => {
    listAIEngines()
      .then((data) => {
        if (data.engines?.length) setEngines(data.engines);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem('ownai-selected-engine', selectedEngine);
  }, [selectedEngine]);

  useEffect(() => {
    if (activeSection === 'chat' && activeSession?.messages.length) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeSession?.messages, activeSection]);

  const ensureSession = useCallback(() => {
    if (activeId && activeSession) return activeId;
    return createSession('chat');
  }, [activeId, activeSession, createSession]);

  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim();
    if ((!trimmed && attachments.length === 0) || loading) return;

    const sessionId = ensureSession();
    setActiveSection('chat');
    setInput('');
    setLoading(true);

    const userLabel = trimmed || `Sent ${attachments.length} attachment(s)`;
    const history = getSessionContext(activeSession?.messages ?? []);
    appendMessage(sessionId, { role: 'user', content: userLabel });
    appendMessage(sessionId, { role: 'assistant', content: '', streaming: true });

    const attachmentIds = attachments.map((a) => a.id);
    const promptText = trimmed || 'Summarize and answer based on the attached files.';
    const { model_key, algorithm_id } = resolveEngine(selectedEngine, engines);

    try {
      const result = await sendAI({
        prompt: promptText,
        history,
        temperature,
        max_tokens: 512,
        model_key,
        algorithm_id,
        attachmentIds,
        sessionId,
        onToken: (full) => {
          updateLastMessage(sessionId, full, true);
        },
      });

      const content = result?.content ?? (typeof result === 'string' ? result : '');
      replaceLastAssistant(sessionId, content || 'No response received.');
      setAttachments([]);

      if (saveToReferenceRef.current && content.trim()) {
        saveToReferenceRef.current(userLabel, content, 'Chat');
      }
    } catch (error) {
      removeStreamingPlaceholder(sessionId);
      appendMessage(sessionId, {
        role: 'assistant',
        content: `Sorry, something went wrong: ${friendlyAIError(error)}`,
      });
    } finally {
      setLoading(false);
    }
  }, [
    loading,
    attachments,
    ensureSession,
    appendMessage,
    updateLastMessage,
    replaceLastAssistant,
    removeStreamingPlaceholder,
    temperature,
    selectedEngine,
    engines,
    sendAI,
    friendlyAIError,
    activeSession,
  ]);

  const handleAttach = async (files) => {
    setUploading(true);
    setUploadError('');
    try {
      const sessionId = activeId || undefined;
      const data = await uploadAttachments(files, sessionId);
      setAttachments((prev) => [...prev, ...(data.attachments || [])]);
      for (const file of files) {
        try {
          await ingestRagDocument(file);
        } catch {
          // RAG ingest optional when backend unavailable
        }
      }
    } catch (error) {
      setUploadError(error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAttachment = async (id) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
    try {
      await deleteAttachment(id);
    } catch {
      // already removed from UI
    }
  };

  const handleNewChat = () => {
    createSession('chat');
    setActiveSection('chat');
    setInput('');
    setAttachments([]);
  };

  const handleStartPrompt = (prompt) => {
    if (!activeId) createSession('chat');
    setActiveSection('chat');
    setInput(prompt);
  };

  const handleSelectSession = (id) => {
    selectSession(id);
    setActiveSection('chat');
  };

  const showWelcome =
    activeSection === 'chat' &&
    (!activeSession || activeSession.messages.length === 0) &&
    !loading;

  const showChat =
    activeSection === 'chat' &&
    activeSession &&
    activeSession.messages.length > 0;

  const sectionViews = ['chats', 'projects', 'artifacts', 'customize', 'code', 'design', 'reference', 'code-library'];
  const showSectionPrompt = sectionViews.includes(activeSection) && !['reference', 'code-library'].includes(activeSection);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[#f7f6f3] dark:bg-slate-950">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.35] dark:opacity-[0.08]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgb(214 211 209 / 0.4) 1px, transparent 1px), linear-gradient(to bottom, rgb(214 211 209 / 0.4) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
        aria-hidden="true"
      />

      <DashboardSidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        onNewChat={handleNewChat}
        sessions={sessions}
        activeSessionId={activeId}
        onSelectSession={handleSelectSession}
        onDeleteSession={deleteSession}
        user={user}
        onSignIn={onSignIn}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />

      <div className="relative flex min-w-0 flex-1 flex-col">
        {sectionViews.includes(activeSection) ? (
          <SectionPanel
            section={activeSection}
            sessions={sessions}
            onSelectSession={handleSelectSession}
            onNewChat={handleNewChat}
            onStartPrompt={handleStartPrompt}
            theme={theme}
            onToggleTheme={onToggleTheme}
            temperature={temperature}
            onTemperatureChange={setTemperature}
            selectedModel={resolveEngine(selectedEngine, engines).model_key}
            saveToReferenceRef={saveToReferenceRef}
          />
        ) : (
          <>
            {showWelcome && (
              <WelcomePanel
                userName={userName}
                onPromptSelect={(prompt) => setInput(prompt)}
              />
            )}
            {showChat && (
              <ChatPanel session={activeSession} loading={loading} />
            )}
            {!showWelcome && !showChat && activeSection === 'chat' && (
              <ChatPanel session={activeSession} loading={loading} />
            )}
            <div
              className={`shrink-0 px-4 pb-6 pt-2 ${
                showWelcome ? 'absolute bottom-0 left-0 right-0' : ''
              }`}
            >
              <BackendConnectPanel />
              <div className="mx-auto mb-2 flex max-w-2xl flex-wrap gap-2 px-1">
                {modeLabel && (
                  <span className="rounded-full border border-stone-200 bg-white px-2.5 py-0.5 text-[11px] text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                    {modeLabel}
                  </span>
                )}
                {taskMode && (
                  <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-[11px] text-teal-800 dark:border-teal-800 dark:bg-teal-950/40">
                    {taskMode}
                  </span>
                )}
                {activeModel && (
                  <span className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-0.5 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-800">
                    {activeModel}
                  </span>
                )}
                {(memoryFacts.name || memoryFacts.role) && (
                  <span className="truncate rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] text-amber-900 dark:border-amber-900 dark:bg-amber-950/30">
                    Remembers: {[memoryFacts.name, memoryFacts.role].filter(Boolean).join(' · ')}
                  </span>
                )}
                <button
                  type="button"
                  onClick={clearMemory}
                  className="rounded-full border border-red-200 px-2.5 py-0.5 text-[11px] text-red-600 hover:bg-red-50 dark:border-red-900"
                >
                  Clear memory
                </button>
              </div>
              {uploadError && (
                <p className="mx-auto mb-2 max-w-2xl text-sm text-red-500">{uploadError}</p>
              )}
              <PromptInput
                value={input}
                onChange={setInput}
                onSubmit={() => sendMessage(input)}
                loading={loading}
                disabled={loading}
                engines={engines}
                selectedEngine={selectedEngine}
                onEngineChange={setSelectedEngine}
                attachments={attachments}
                onAttach={handleAttach}
                onRemoveAttachment={handleRemoveAttachment}
                uploading={uploading}
                onVoiceTranscript={(text) => setInput((prev) => (prev ? `${prev} ${text}` : text))}
              />
            </div>
          </>
        )}

        {showSectionPrompt && (
          <div className="shrink-0 border-t border-stone-200 bg-[#f7f6f3]/90 px-4 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
            <BackendConnectPanel />
            {uploadError && (
              <p className="mx-auto mb-2 max-w-2xl text-sm text-red-500">{uploadError}</p>
            )}
            <PromptInput
              value={input}
              onChange={setInput}
              onSubmit={() => sendMessage(input)}
              loading={loading}
              placeholder="Ask OWNAI anything…"
              engines={engines}
              selectedEngine={selectedEngine}
              onEngineChange={setSelectedEngine}
              attachments={attachments}
              onAttach={handleAttach}
              onRemoveAttachment={handleRemoveAttachment}
              uploading={uploading}
              onVoiceTranscript={(text) => setInput((prev) => (prev ? `${prev} ${text}` : text))}
            />
          </div>
        )}

        <div ref={chatEndRef} />
      </div>
    </div>
  );
}
