import { useState, useCallback, useEffect } from 'react';
import Sidebar from './Sidebar.jsx';
import HomeView from './HomeView.jsx';
import ChatView from './ChatView.jsx';
import useChatSessions from '../hooks/useChatSessions.js';
import useAI from '../hooks/useAI.js';
import { getSessionContext } from '../utils/memory.js';
import { setOwnaiSessionId } from '../utils/sessionId.js';
import { generateChatTitle } from '../utils/generateChatTitle.js';
import {
  uploadAttachments,
  deleteAttachment,
  listAIEngines,
  ingestRagDocument,
  getMe,
  logout,
} from '../api/client.js';
import { canReachBackend, isAuthRequiredError } from '../utils/apiConfig.js';
import AuthModal from './AuthModal.jsx';
import { FALLBACK_ENGINES, resolveEngine } from '../utils/aiEngines.js';

const DEFAULT_ENGINES = FALLBACK_ENGINES;

export default function AppLayout({ theme, onToggleTheme }) {
  const [user, setUser] = useState(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [engines, setEngines] = useState(DEFAULT_ENGINES);
  const [selectedEngine, setSelectedEngine] = useState(
    () => localStorage.getItem('ownai-selected-engine') || DEFAULT_ENGINES[0].key,
  );
  const [temperature] = useState(0.7);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [backendReady, setBackendReady] = useState(false);
  const [thinkingMode, setThinkingMode] = useState(
    () => localStorage.getItem('ownai-thinking-mode') || 'auto',
  );
  const [loadedDocument, setLoadedDocument] = useState(null);
  const [showHome, setShowHome] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const openSignIn = useCallback(() => setAuthOpen(true), []);
  const handleAuth = useCallback((nextUser) => {
    setUser(nextUser);
    setAuthOpen(false);
  }, []);
  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } catch {
      // clear local session anyway
    }
    setUser(null);
  }, []);

  const {
    sessions,
    activeId,
    activeSession,
    createSession,
    selectSession,
    clearActiveSession,
    deleteSession,
    updateSessionTitle,
    appendMessage,
    updateLastMessage,
    patchLastAssistant,
    replaceLastAssistant,
    removeStreamingPlaceholder,
  } = useChatSessions();

  const { send: sendAI, friendlyAIError } = useAI();

  const userName = user?.email?.split('@')[0];

  useEffect(() => {
    getMe().then((data) => setUser(data.user)).catch(() => setUser(null));
    listAIEngines().then((data) => {
      if (data.engines?.length) setEngines(data.engines);
    }).catch(() => {});
    canReachBackend(3).then(setBackendReady);
  }, []);

  useEffect(() => {
    localStorage.setItem('ownai-selected-engine', selectedEngine);
  }, [selectedEngine]);

  useEffect(() => {
    localStorage.setItem('ownai-thinking-mode', thinkingMode);
  }, [thinkingMode]);

  const handleNewChat = useCallback(() => {
    clearActiveSession();
    setShowHome(true);
    setInput('');
    setAttachments([]);
    setLoadedDocument(null);
  }, [clearActiveSession]);

  const handleSelectChat = useCallback((id) => {
    selectSession(id);
    setShowHome(false);
    setInput('');
    setAttachments([]);
  }, [selectSession]);

  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim();
    if ((!trimmed && attachments.length === 0) || loading) return;

    let sessionId = activeId;
    const isFirstMessage = !sessionId || !activeSession?.messages?.length;

    if (!sessionId) {
      sessionId = createSession('chat');
      setShowHome(false);
    }

    setOwnaiSessionId(sessionId);
    setInput('');
    setLoading(true);

    const userLabel = trimmed || `Sent ${attachments.length} attachment(s)`;
    const history = isFirstMessage
      ? []
      : getSessionContext(activeSession?.messages ?? []);
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
        onToken: (full) => updateLastMessage(sessionId, full, true),
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

      const content = result?.content ?? '';
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

      if (isFirstMessage && userLabel) {
        generateChatTitle(userLabel).then((title) => {
          updateSessionTitle(sessionId, title);
        }).catch(() => {});
      }
    } catch (error) {
      removeStreamingPlaceholder(sessionId);
      if (isAuthRequiredError(error)) {
        setAuthOpen(true);
      }
      appendMessage(sessionId, {
        role: 'assistant',
        content: friendlyAIError(error),
      });
    } finally {
      setLoading(false);
    }
  }, [
    loading,
    attachments,
    activeId,
    activeSession,
    createSession,
    appendMessage,
    updateLastMessage,
    patchLastAssistant,
    replaceLastAssistant,
    removeStreamingPlaceholder,
    updateSessionTitle,
    temperature,
    selectedEngine,
    engines,
    sendAI,
    friendlyAIError,
    thinkingMode,
  ]);

  const handleAttach = async (files) => {
    const reachable = await canReachBackend(3);
    setBackendReady(reachable);
    if (!reachable) return;

    setUploading(true);
    try {
      const sessionId = activeId || undefined;
      const data = await uploadAttachments(files, sessionId);
      setAttachments((prev) => [...prev, ...(data.attachments || [])]);
      for (const file of files) {
        try {
          await ingestRagDocument(file, sessionId);
          setLoadedDocument(file.name);
        } catch (err) {
          if (isAuthRequiredError(err)) {
            setAuthOpen(true);
            break;
          }
        }
      }
    } catch (err) {
      if (isAuthRequiredError(err)) {
        setAuthOpen(true);
      }
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

  const inHomeView = showHome || (!activeId && !loading);
  const inChatView = activeId && activeSession && !showHome;

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[#f7f6f3] dark:bg-slate-950">
      {/* Mobile overlay */}
      {sidebarOpen && !sidebarCollapsed && (
        <button
          type="button"
          className="fixed inset-0 z-20 bg-black/30 md:hidden"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-30 transition-transform md:static md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar
          chats={sessions}
          activeChatId={activeId}
          onNewChat={handleNewChat}
          onSelectChat={(id) => {
            handleSelectChat(id);
            setSidebarOpen(false);
          }}
          onDeleteChat={deleteSession}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => {
            setSidebarCollapsed((c) => !c);
            setSidebarOpen((o) => !o);
          }}
          user={user}
          onSignIn={openSignIn}
          onLogout={handleLogout}
        />
      </div>

      <main className="relative flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-stone-200/80 px-4 py-2.5 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              setSidebarOpen(true);
              setSidebarCollapsed(false);
            }}
              className="rounded-lg p-2 text-slate-600 hover:bg-stone-200 md:hidden dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Open sidebar"
          >
            ☰
          </button>
          {loadedDocument && (
            <span className="truncate text-xs text-emerald-700 dark:text-emerald-400">
              ✓ {loadedDocument} loaded
            </span>
          )}
          {!user && backendReady && (
            <button
              type="button"
              onClick={openSignIn}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 dark:text-violet-300 dark:hover:bg-violet-950/50"
            >
              Sign in
            </button>
          )}
          <div className="ml-auto">
            <button
              type="button"
              onClick={onToggleTheme}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-stone-200 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>
        </div>

        {inHomeView && (
          <HomeView
            onSend={sendMessage}
            username={userName}
            sessionId={activeId}
            onDocumentUploaded={setLoadedDocument}
            loading={loading}
          />
        )}

        {inChatView && (
          <ChatView
            session={activeSession}
            loading={loading}
            input={input}
            onInputChange={setInput}
            onSubmit={() => sendMessage(input)}
            engines={engines}
            selectedEngine={selectedEngine}
            onEngineChange={setSelectedEngine}
            attachments={attachments}
            onAttach={handleAttach}
            onRemoveAttachment={handleRemoveAttachment}
            uploading={uploading}
            thinkingMode={thinkingMode}
            onThinkingModeChange={setThinkingMode}
            onVoiceTranscript={(text) => setInput((prev) => (prev ? `${prev} ${text}` : text))}
            sessionId={activeId}
            onDocumentUploaded={setLoadedDocument}
            backendReady={backendReady}
          />
        )}
      </main>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuth={handleAuth}
      />
    </div>
  );
}
