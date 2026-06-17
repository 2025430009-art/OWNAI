import { useState, useCallback, useRef, useEffect } from 'react';
import DashboardSidebar from '../components/dashboard/DashboardSidebar.jsx';
import WelcomePanel from '../components/dashboard/WelcomePanel.jsx';
import ChatPanel from '../components/dashboard/ChatPanel.jsx';
import PromptInput from '../components/dashboard/PromptInput.jsx';
import DocumentUpload from '../components/DocumentUpload.jsx';
import SectionPanel from '../components/dashboard/SectionPanel.jsx';
import ResearchPage from './ResearchPage.jsx';
import useChatSessions from '../hooks/useChatSessions.js';
import useResearchProject from '../hooks/useResearchProject.js';
import { uploadAttachments, deleteAttachment, listAIEngines, ingestRagDocument, listMemories, listThinkingLogs } from '../api/client.js';
import useAI from '../hooks/useAI.js';
import { canReachBackend } from '../utils/apiConfig.js';
import MemoryPanel from '../components/dashboard/MemoryPanel.jsx';
import ThinkingHistoryPanel from '../components/dashboard/ThinkingHistoryPanel.jsx';
import { getSessionContext } from '../utils/memory.js';
import { FALLBACK_ENGINES, resolveEngine } from '../utils/aiEngines.js';

const DEFAULT_ENGINES = FALLBACK_ENGINES;

export default function DashboardPage({
  models,
  user,
  onSignIn,
  onNavigate,
  theme,
  onToggleTheme,
}) {
  const { project, activeCount } = useResearchProject();
  const {
    sessions,
    activeId,
    activeSession,
    createSession,
    selectSession,
    deleteSession,
    appendMessage,
    updateLastMessage,
    patchLastAssistant,
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
  const [backendReady, setBackendReady] = useState(false);
  const [thinkingMode, setThinkingMode] = useState(
    () => localStorage.getItem('ownai-thinking-mode') || 'auto',
  );
  const [memoryPanelOpen, setMemoryPanelOpen] = useState(false);
  const [thinkingHistoryOpen, setThinkingHistoryOpen] = useState(false);
  const [memoryCount, setMemoryCount] = useState(null);
  const [thinkingLogs, setThinkingLogs] = useState([]);
  const [loadedDocument, setLoadedDocument] = useState(null);
  const chatEndRef = useRef(null);
  const saveToReferenceRef = useRef(null);
  const { send: sendAI, friendlyAIError, taskMode, activeModel, memoryFacts, clearMemory } = useAI();

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
    localStorage.setItem('ownai-thinking-mode', thinkingMode);
  }, [thinkingMode]);

  const refreshMemoryAndLogs = useCallback(() => {
    if (!user) return;
    listMemories()
      .then((data) => setMemoryCount((data.memories || []).length))
      .catch(() => setMemoryCount(null));
    listThinkingLogs()
      .then((data) => setThinkingLogs((data.logs || []).slice(0, 10)))
      .catch(() => setThinkingLogs([]));
  }, [user]);

  useEffect(() => {
    refreshMemoryAndLogs();
  }, [refreshMemoryAndLogs]);

  useEffect(() => {
    canReachBackend().then(setBackendReady);
  }, [uploadError, loading]);

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
    let latestThinking = '';
    let latestConfidence = null;
    let latestThinkingResult = null;
    let latestReasoningMode = null;
    let latestModeReason = null;
    let latestAutoDetected = null;
    let latestConfidenceDetail = null;

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
        thinkingModeUi: thinkingMode,
        onToken: (full) => {
          updateLastMessage(sessionId, full, true);
        },
        onThinking: (thinking) => {
          latestThinking = thinking;
          patchLastAssistant(sessionId, { thinking, streaming: true });
        },
        onMeta: (meta) => {
          if (meta.reasoning_mode) {
            latestReasoningMode = meta.reasoning_mode;
            patchLastAssistant(sessionId, {
              reasoningMode: meta.reasoning_mode,
              modeReason: meta.mode_reason,
              autoDetected: meta.auto_detected,
            });
          }
          if (meta.mode_reason) latestModeReason = meta.mode_reason;
          if (meta.auto_detected != null) latestAutoDetected = meta.auto_detected;
        },
        onConfidence: (confidence) => {
          latestConfidence = confidence;
          latestConfidenceDetail = confidence?.detail;
          patchLastAssistant(sessionId, {
            confidence,
            confidenceDetail: confidence?.detail,
          });
        },
        onThinkingResult: (thinkingResult) => {
          latestThinkingResult = thinkingResult;
          patchLastAssistant(sessionId, { thinkingResult, streaming: true });
        },
      });

      const content = result?.content ?? (typeof result === 'string' ? result : '');
      replaceLastAssistant(sessionId, content || 'No response received.', {
        thinking: result?.thinking ?? latestThinking,
        confidence: result?.confidence ?? latestConfidence,
        confidenceDetail: result?.confidenceDetail ?? latestConfidenceDetail,
        thinkingResult: result?.thinkingResult ?? latestThinkingResult,
        reasoningMode: result?.reasoningMode ?? latestReasoningMode,
        modeReason: result?.modeReason ?? latestModeReason,
        autoDetected: result?.autoDetected ?? latestAutoDetected,
      });
      setAttachments([]);
      refreshMemoryAndLogs();

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
    patchLastAssistant,
    replaceLastAssistant,
    removeStreamingPlaceholder,
    temperature,
    selectedEngine,
    engines,
    sendAI,
    friendlyAIError,
    activeSession,
    thinkingMode,
    refreshMemoryAndLogs,
  ]);

  const handleAttach = async (files) => {
    setUploadError('');
    const reachable = await canReachBackend();
    setBackendReady(reachable);
    if (!reachable) {
      setUploadError('Connect your OWNAI backend above to attach PDFs and other files.');
      return;
    }

    setUploading(true);
    try {
      const sessionId = activeId || undefined;
      const data = await uploadAttachments(files, sessionId);
      setAttachments((prev) => [...prev, ...(data.attachments || [])]);
      for (const file of files) {
        try {
          await ingestRagDocument(file);
          setLoadedDocument(file.name);
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

  const handleRecallMemory = () => {
    setMemoryPanelOpen(false);
    sendMessage('What do you remember about me?');
  };

  const showWelcome =
    activeSection === 'chat' &&
    (!activeSession || activeSession.messages.length === 0) &&
    !loading;

  const showChat =
    activeSection === 'chat' &&
    activeSession &&
    activeSession.messages.length > 0;

  const sectionViews = ['chats', 'projects', 'artifacts', 'customize', 'code', 'design', 'human-think', 'prompt-to-video', 'reference', 'code-library', 'research'];
  const showSectionPrompt = sectionViews.includes(activeSection) && !['reference', 'code-library', 'research', 'prompt-to-video', 'human-think'].includes(activeSection);

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
        researchCount={activeCount}
        memoryCount={memoryCount}
        onOpenMemory={() => setMemoryPanelOpen(true)}
        thinkingLogs={thinkingLogs}
        onOpenThinkingHistory={() => setThinkingHistoryOpen(true)}
        taskMode={taskMode}
        activeModel={activeModel}
        memoryFacts={memoryFacts}
        onClearMemory={clearMemory}
        backendNotice={uploadError || null}
        onBackendConnected={() => canReachBackend().then(setBackendReady)}
      />

      <div className="relative flex min-w-0 flex-1 flex-col">
        {activeSection === 'research' ? (
          <div className="flex-1 overflow-y-auto">
            <ResearchPage user={user} onNavigate={onNavigate} onSignIn={onSignIn} />
          </div>
        ) : sectionViews.includes(activeSection) ? (
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
              <ChatPanel
                session={activeSession}
                loading={loading}
                researchProjectId={project?.id}
                user={user}
                memoryCount={memoryCount}
                onOpenMemory={() => setMemoryPanelOpen(true)}
              />
            )}
            {!showWelcome && !showChat && activeSection === 'chat' && (
              <ChatPanel
                session={activeSession}
                loading={loading}
                researchProjectId={project?.id}
                user={user}
                memoryCount={memoryCount}
                onOpenMemory={() => setMemoryPanelOpen(true)}
              />
            )}
            <div
              className={`shrink-0 px-4 pb-6 pt-2 ${
                showWelcome ? 'absolute bottom-0 left-0 right-0' : ''
              }`}
            >
              <div className="mx-auto mb-2 flex max-w-2xl justify-center">
                <DocumentUpload onUploaded={(name) => setLoadedDocument(name)} />
              </div>
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
                showResearchTemplates
                onTemplateSelect={(prompt) => setInput(prompt)}
                thinkingMode={thinkingMode}
                onThinkingModeChange={setThinkingMode}
                attachDisabled={!backendReady}
                attachHint="Connect backend to attach files"
              />
            </div>
          </>
        )}

        {showSectionPrompt && (
          <div className="shrink-0 border-t border-stone-200 bg-[#f7f6f3]/90 px-4 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
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
              showResearchTemplates
              onTemplateSelect={(prompt) => setInput(prompt)}
              thinkingMode={thinkingMode}
              onThinkingModeChange={setThinkingMode}
              attachDisabled={!backendReady}
              attachHint="Connect backend to attach files"
            />
          </div>
        )}

        <MemoryPanel
          open={memoryPanelOpen}
          onClose={() => setMemoryPanelOpen(false)}
          user={user}
          onRecall={handleRecallMemory}
        />
        <ThinkingHistoryPanel
          open={thinkingHistoryOpen}
          onClose={() => setThinkingHistoryOpen(false)}
          user={user}
        />

        <div ref={chatEndRef} />
      </div>
    </div>
  );
}
