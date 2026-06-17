import { useState, useCallback, useEffect } from 'react';
import {
  loadSessions,
  saveSessions,
  loadActiveSessionId,
  saveActiveSessionId,
  createEmptySession,
  titleFromFirstMessage,
  withMessageTimestamp,
} from '../utils/chatStorage.js';

function resolveInitialActiveId(sessions) {
  const stored = loadActiveSessionId();
  if (stored && sessions.some((s) => s.id === stored)) return stored;
  return sessions[0]?.id ?? null;
}

export default function useChatSessions() {
  const [sessions, setSessions] = useState(loadSessions);
  const [activeId, setActiveId] = useState(() => resolveInitialActiveId(loadSessions()));

  useEffect(() => {
    saveActiveSessionId(activeId);
  }, [activeId]);

  const persist = useCallback((next) => {
    saveSessions(next);
    return next;
  }, []);

  const selectSession = useCallback((id) => {
    setActiveId(id);
    saveActiveSessionId(id);
  }, []);

  const createSession = useCallback((section = 'chat') => {
    const session = createEmptySession(section);
    setSessions((prev) => persist([session, ...prev]));
    setActiveId(session.id);
    saveActiveSessionId(session.id);
    return session.id;
  }, [persist]);

  const deleteSession = useCallback((id) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      persist(next);
      setActiveId((current) => {
        if (current !== id) return current;
        const fallback = next[0]?.id ?? null;
        saveActiveSessionId(fallback);
        return fallback;
      });
      return next;
    });
  }, [persist]);

  const appendMessage = useCallback((sessionId, message) => {
    const stamped = withMessageTimestamp(message);
    setSessions((prev) => {
      const next = prev.map((s) => {
        if (s.id !== sessionId) return s;
        const messages = [...s.messages, stamped];
        const title = s.messages.length === 0 && stamped.role === 'user'
          ? titleFromFirstMessage(stamped.content)
          : s.title;
        return {
          ...s,
          messages,
          title,
          updatedAt: stamped.timestamp,
        };
      });
      return persist(next);
    });
  }, [persist]);

  const updateLastMessage = useCallback((sessionId, content, streaming = false) => {
    setSessions((prev) => {
      const next = prev.map((s) => {
        if (s.id !== sessionId) return s;
        const messages = [...s.messages];
        const last = messages[messages.length - 1];
        if (last?.role === 'assistant') {
          messages[messages.length - 1] = {
            ...last,
            content,
            streaming,
            timestamp: last.timestamp || new Date().toISOString(),
          };
        }
        return { ...s, messages, updatedAt: new Date().toISOString() };
      });
      return persist(next);
    });
  }, [persist]);

  const patchLastAssistant = useCallback((sessionId, patch) => {
    setSessions((prev) => {
      const next = prev.map((s) => {
        if (s.id !== sessionId) return s;
        const messages = [...s.messages];
        const last = messages[messages.length - 1];
        if (last?.role === 'assistant') {
          messages[messages.length - 1] = {
            ...last,
            ...patch,
            role: 'assistant',
            timestamp: last.timestamp || new Date().toISOString(),
          };
        }
        return { ...s, messages, updatedAt: new Date().toISOString() };
      });
      return persist(next);
    });
  }, [persist]);

  const replaceLastAssistant = useCallback((sessionId, content, extras = {}) => {
    setSessions((prev) => {
      const next = prev.map((s) => {
        if (s.id !== sessionId) return s;
        const messages = [...s.messages];
        const last = messages[messages.length - 1];
        if (last?.role === 'assistant') {
          messages[messages.length - 1] = {
            ...last,
            role: 'assistant',
            content,
            ...extras,
            streaming: false,
            timestamp: last.timestamp || new Date().toISOString(),
          };
        }
        return { ...s, messages, updatedAt: new Date().toISOString() };
      });
      return persist(next);
    });
  }, [persist]);

  const removeStreamingPlaceholder = useCallback((sessionId) => {
    setSessions((prev) => {
      const next = prev.map((s) => {
        if (s.id !== sessionId) return s;
        return {
          ...s,
          messages: s.messages.filter((m) => !m.streaming),
        };
      });
      return persist(next);
    });
  }, [persist]);

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
