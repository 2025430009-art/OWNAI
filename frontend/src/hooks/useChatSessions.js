import { useState, useCallback } from 'react';

const STORAGE_KEY = 'ownai_chat_sessions';

function loadSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function makeId() {
  return crypto.randomUUID();
}

function titleFromMessage(text) {
  const trimmed = text.trim();
  if (!trimmed) return 'New conversation';
  return trimmed.length > 42 ? `${trimmed.slice(0, 42)}…` : trimmed;
}

export default function useChatSessions() {
  const [sessions, setSessions] = useState(loadSessions);
  const [activeId, setActiveId] = useState(() => sessions[0]?.id ?? null);

  const selectSession = useCallback((id) => {
    setActiveId(id);
  }, []);

  const createSession = useCallback((section = 'chat') => {
    const session = {
      id: makeId(),
      title: 'New conversation',
      section,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setSessions((prev) => {
      const next = [session, ...prev];
      saveSessions(next);
      return next;
    });
    setActiveId(session.id);
    return session.id;
  }, []);

  const deleteSession = useCallback((id) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      saveSessions(next);
      setActiveId((current) => {
        if (current !== id) return current;
        return next[0]?.id ?? null;
      });
      return next;
    });
  }, []);

  const appendMessage = useCallback((sessionId, message) => {
    setSessions((prev) => {
      const next = prev.map((s) => {
        if (s.id !== sessionId) return s;
        const messages = [...s.messages, message];
        const title = s.messages.length === 0 && message.role === 'user'
          ? titleFromMessage(message.content)
          : s.title;
        return { ...s, messages, title, updatedAt: Date.now() };
      });
      saveSessions(next);
      return next;
    });
  }, []);

  const updateLastMessage = useCallback((sessionId, content, streaming = false) => {
    setSessions((prev) => {
      const next = prev.map((s) => {
        if (s.id !== sessionId) return s;
        const messages = [...s.messages];
        const last = messages[messages.length - 1];
        if (last?.role === 'assistant') {
          messages[messages.length - 1] = { role: 'assistant', content, streaming };
        }
        return { ...s, messages, updatedAt: Date.now() };
      });
      saveSessions(next);
      return next;
    });
  }, []);

  const patchLastAssistant = useCallback((sessionId, patch) => {
    setSessions((prev) => {
      const next = prev.map((s) => {
        if (s.id !== sessionId) return s;
        const messages = [...s.messages];
        const last = messages[messages.length - 1];
        if (last?.role === 'assistant') {
          messages[messages.length - 1] = { ...last, ...patch, role: 'assistant' };
        }
        return { ...s, messages, updatedAt: Date.now() };
      });
      saveSessions(next);
      return next;
    });
  }, []);

  const replaceLastAssistant = useCallback((sessionId, content, extras = {}) => {
    setSessions((prev) => {
      const next = prev.map((s) => {
        if (s.id !== sessionId) return s;
        const messages = [...s.messages];
        const last = messages[messages.length - 1];
        if (last?.role === 'assistant') {
          messages[messages.length - 1] = { role: 'assistant', content, ...extras };
        }
        return { ...s, messages, updatedAt: Date.now() };
      });
      saveSessions(next);
      return next;
    });
  }, []);

  const removeStreamingPlaceholder = useCallback((sessionId) => {
    setSessions((prev) => {
      const next = prev.map((s) => {
        if (s.id !== sessionId) return s;
        return {
          ...s,
          messages: s.messages.filter((m) => !m.streaming),
        };
      });
      saveSessions(next);
      return next;
    });
  }, []);

  const activeSession = sessions.find((s) => s.id === activeId) ?? null;

  return {
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
  };
}
