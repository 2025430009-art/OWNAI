import { useCallback, useEffect, useRef, useState } from 'react';
import {
  generatePromptToVideo,
  listPromptToVideoJobs,
  cancelPromptToVideoJob,
  getPromptToVideoSteps,
} from '../api/client.js';
import { wsUrl } from '../utils/apiConfig.js';

function applyProgressEvent(parsed, setters) {
  const {
    setCurrentStep,
    setProgress,
    setScript,
    setScenePreviews,
    setResult,
    setView,
    setLoading,
    setError,
    refreshJobs,
  } = setters;

  if (parsed.type === 'progress') {
    if (parsed.step) setCurrentStep(parsed.step);
    if (parsed.progress != null) setProgress(parsed.progress);
    if (parsed.script) setScript(parsed.script);
    if (parsed.previewCount) setScenePreviews(parsed.previewCount);
    return;
  }

  if (parsed.type === 'complete' && parsed.result) {
    setResult(parsed.result);
    setProgress(100);
    setView('player');
    setLoading(false);
    refreshJobs?.();
    return;
  }

  if (parsed.type === 'error') {
    setError(parsed.error || 'Generation failed');
    setLoading(false);
  }
}

export default function usePromptToVideo() {
  const [prompt, setPrompt] = useState('');
  const [view, setView] = useState('home');
  const [steps, setSteps] = useState([]);
  const [examples, setExamples] = useState([]);
  const [qualities, setQualities] = useState([
    { id: '480p', label: '480p SD' },
    { id: '720p', label: '720p HD' },
    { id: '1080p', label: '1080p Full HD' },
  ]);
  const [quality, setQuality] = useState('1080p');
  const [currentStep, setCurrentStep] = useState(null);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [script, setScript] = useState(null);
  const [scenePreviews, setScenePreviews] = useState(0);
  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [wsStatus, setWsStatus] = useState('idle');

  const wsRef = useRef(null);
  const wsConnectedRef = useRef(false);
  const abortRef = useRef(false);
  const activeJobIdRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const loadingRef = useRef(false);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    getPromptToVideoSteps()
      .then((data) => {
        setSteps(data.steps || []);
        setExamples(data.examples || []);
        if (data.qualities?.length) setQualities(data.qualities);
      })
      .catch(() => {});
  }, []);

  const refreshJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      const data = await listPromptToVideoJobs();
      setJobs(data.jobs || []);
    } catch {
      // history optional when backend offline
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  useEffect(() => {
    if (view === 'history') refreshJobs();
  }, [view, refreshJobs]);

  useEffect(() => () => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    wsRef.current?.close();
  }, []);

  const getSetters = useCallback(() => ({
    setCurrentStep,
    setProgress,
    setScript,
    setScenePreviews,
    setResult,
    setView,
    setLoading,
    setError,
    refreshJobs,
  }), [refreshJobs]);

  const disconnectWs = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    wsConnectedRef.current = false;
    wsRef.current?.close();
    wsRef.current = null;
    setWsStatus('idle');
  }, []);

  const connectWs = useCallback((jobId) => {
    if (!jobId) return;

    const url = wsUrl('/api/v1/prompt-to-video/ws', { jobId });
    if (!url) {
      setWsStatus('unavailable');
      return;
    }

    wsRef.current?.close();
    setWsStatus('connecting');

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      wsConnectedRef.current = true;
      setWsStatus('connected');
      ws.send(JSON.stringify({ type: 'subscribe', jobId }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'connected' || data.type === 'subscribed') return;
        applyProgressEvent(data, getSetters());
      } catch {
        // ignore malformed frames
      }
    };

    ws.onerror = () => {
      wsConnectedRef.current = false;
      setWsStatus('error');
    };

    ws.onclose = () => {
      wsConnectedRef.current = false;
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
      if (abortRef.current || !loadingRef.current) {
        setWsStatus('idle');
        return;
      }
      setWsStatus('reconnecting');
      reconnectTimerRef.current = setTimeout(() => {
        if (activeJobIdRef.current && loadingRef.current && !abortRef.current) {
          connectWs(activeJobIdRef.current);
        }
      }, 1500);
    };
  }, [getSetters]);

  const cancel = useCallback(async () => {
    abortRef.current = true;
    disconnectWs();
    const jobId = activeJobIdRef.current || result?.jobId;
    if (jobId) {
      try {
        await cancelPromptToVideoJob(jobId);
      } catch {
        // best effort
      }
    }
    setLoading(false);
    setView('home');
  }, [result?.jobId, disconnectWs]);

  const generate = useCallback(async (text = prompt) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    abortRef.current = false;
    activeJobIdRef.current = null;
    disconnectWs();
    setLoading(true);
    setError('');
    setResult(null);
    setScript(null);
    setProgress(0);
    setCurrentStep(null);
    setScenePreviews(0);
    setView('generate');

    try {
      const response = await generatePromptToVideo({ prompt: trimmed, stream: true, quality });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const setters = getSetters();

      while (true) {
        const { done, value } = await reader.read();
        if (done || abortRef.current) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);

            if (parsed.type === 'started' && parsed.jobId) {
              activeJobIdRef.current = parsed.jobId;
              connectWs(parsed.jobId);
            }

            // SSE fallback only when WebSocket is not connected
            if (!wsConnectedRef.current) {
              if (parsed.type === 'progress') {
                applyProgressEvent(parsed, setters);
              }
              if (parsed.type === 'done' && parsed.result) {
                setResult(parsed.result);
                setProgress(100);
                setView('player');
                setLoading(false);
                refreshJobs();
              }
              if (parsed.type === 'error') {
                setError(parsed.error);
                setLoading(false);
              }
            }
          } catch {
            // skip malformed chunks
          }
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      disconnectWs();
    }
  }, [prompt, quality, loading, connectWs, disconnectWs, getSetters, refreshJobs]);

  return {
    prompt,
    setPrompt,
    view,
    setView,
    steps,
    examples,
    qualities,
    quality,
    setQuality,
    currentStep,
    progress,
    loading,
    error,
    result,
    script,
    scenePreviews,
    jobs,
    loadingJobs,
    wsStatus,
    generate,
    cancel,
    refreshJobs,
    setResult,
  };
}
