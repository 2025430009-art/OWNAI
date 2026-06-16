import { useState, useEffect, useCallback } from 'react';
import {
  getApiBase,
  setApiBase,
  clearApiBase,
  probeBackend,
  isStaticHosting,
  detectAIMode,
  getModeLabel,
  canReachBackend,
  AI_MODES,
  DEFAULT_LOCAL_API_URL,
} from '../../utils/apiConfig.js';

function StatusDot({ tone = 'neutral' }) {
  const colors = {
    online: 'bg-emerald-500',
    offline: 'bg-amber-400',
    local: 'bg-violet-500',
    error: 'bg-red-500',
    neutral: 'bg-slate-300',
  };
  return <span className={`h-2 w-2 shrink-0 rounded-full ${colors[tone] || colors.neutral}`} />;
}

export default function BackendConnectPanel({
  onConnected,
  compact = false,
  taskMode,
  activeModel,
  memoryFacts,
  onClearMemory,
  notice,
}) {
  const [url, setUrl] = useState(() => getApiBase() || DEFAULT_LOCAL_API_URL);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [mode, setMode] = useState(AI_MODES.STATIC);
  const [modeLabel, setModeLabel] = useState('');

  const refreshMode = useCallback(async () => {
    const backendUp = await canReachBackend();
    setConnected(backendUp);
    const m = await detectAIMode();
    setMode(m);
    setModeLabel(getModeLabel(m));
    if (backendUp) setStatus('connected');
    return backendUp;
  }, []);

  useEffect(() => {
    refreshMode();
  }, [refreshMode]);

  const handleConnect = async (e) => {
    e?.preventDefault();
    setError('');
    setStatus('checking');

    try {
      const base = setApiBase(url);
      await probeBackend(base);
      setConnected(true);
      setStatus('connected');
      await refreshMode();
      onConnected?.(base);
    } catch (err) {
      clearApiBase();
      setConnected(false);
      setStatus('error');
      setError(err.message || 'Could not reach backend');
    }
  };

  const handleDisconnect = () => {
    clearApiBase();
    setConnected(false);
    setStatus('idle');
    setUrl(DEFAULT_LOCAL_API_URL);
    onConnected?.('');
    refreshMode();
  };

  const dotTone = connected
    ? mode === AI_MODES.LOCAL
      ? 'local'
      : 'online'
    : status === 'error'
      ? 'error'
      : 'offline';

  const showConnectForm = isStaticHosting() && !connected;
  const memoryLine = [memoryFacts?.name, memoryFacts?.role].filter(Boolean).join(' · ');

  if (compact) {
    return (
      <div className="space-y-2 text-xs">
        <div className="flex items-center gap-2 text-slate-500">
          <StatusDot tone={dotTone} />
          <span>{modeLabel || 'Detecting…'}</span>
        </div>
        {showConnectForm && (
          <form onSubmit={handleConnect} className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-api.example.com"
              className="min-w-0 flex-1 rounded-lg border border-stone-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
            />
            <button type="submit" className="rounded-lg bg-teal-600 px-3 py-1.5 text-white">
              Connect
            </button>
          </form>
        )}
        {error && <p className="text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mx-auto mb-3 max-w-2xl">
      <div className="rounded-xl border border-stone-200/80 bg-white/90 shadow-sm backdrop-blur dark:border-slate-700/80 dark:bg-slate-900/90">
        {/* Status row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-stone-100 px-3 py-2.5 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <StatusDot tone={dotTone} />
            <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
              {modeLabel || 'Detecting…'}
            </span>
          </div>

          {taskMode && (
            <span className="rounded-full border border-teal-200/80 bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-800 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-200">
              {taskMode}
            </span>
          )}
          {activeModel && (
            <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {activeModel}
            </span>
          )}
          {memoryLine && (
            <span className="max-w-[12rem] truncate rounded-full border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              {memoryLine}
            </span>
          )}

          <div className="ml-auto flex items-center gap-2">
            {onClearMemory && (
              <button
                type="button"
                onClick={onClearMemory}
                className="text-[10px] text-slate-400 hover:text-red-600 dark:hover:text-red-400"
              >
                Clear memory
              </button>
            )}
            {connected && getApiBase() && (
              <button
                type="button"
                onClick={handleDisconnect}
                className="text-[10px] font-medium text-teal-700 hover:underline dark:text-teal-400"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>

        {/* Backend connect (GitHub Pages / no API) */}
        {showConnectForm && (
          <div className="px-3 py-3">
            <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              Chat works offline on this page. Connect your OWNAI API for{' '}
              <span className="text-slate-600 dark:text-slate-300">PDF uploads</span>, thinking modes, and sign-in.
            </p>
            <form onSubmit={handleConnect} className="mt-2.5 flex flex-col gap-2 sm:flex-row">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-tunnel.trycloudflare.com or http://localhost:3002"
                className="min-w-0 flex-1 rounded-lg border border-stone-200 bg-stone-50/80 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500/30 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-100"
              />
              <button
                type="submit"
                disabled={status === 'checking'}
                className="shrink-0 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:opacity-60"
              >
                {status === 'checking' ? 'Connecting…' : 'Connect'}
              </button>
            </form>
            {error && (
              <p className="mt-2 text-[11px] text-red-600 dark:text-red-400">{error}</p>
            )}
          </div>
        )}

        {/* Connected backend URL (subtle) */}
        {connected && getApiBase() && (
          <div className="px-3 py-2">
            <p className="truncate text-[10px] text-slate-400">
              API — <code className="text-slate-500 dark:text-slate-400">{getApiBase()}</code>
            </p>
          </div>
        )}

        {/* Inline notice (upload errors, etc.) */}
        {notice && (
          <div className="border-t border-amber-100 bg-amber-50/60 px-3 py-2 dark:border-amber-900/40 dark:bg-amber-950/20">
            <p className="text-[11px] text-amber-900 dark:text-amber-200">{notice}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export { canReachBackend };
