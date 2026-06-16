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
  variant = 'inline',
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
  const isSidebar = variant === 'sidebar';

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
    <div className={isSidebar ? 'px-2 pb-2' : 'mx-auto mb-3 max-w-2xl'}>
      <div className={`rounded-xl border border-stone-200/80 bg-white/90 shadow-sm backdrop-blur dark:border-slate-700/80 dark:bg-slate-900/90 ${isSidebar ? 'overflow-hidden' : ''}`}>
        {isSidebar && (
          <p className="border-b border-stone-100 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:border-slate-800">
            Session
          </p>
        )}
        {/* Status row */}
        <div className={`flex flex-wrap items-center gap-x-2 gap-y-1.5 px-3 py-2.5 ${isSidebar ? '' : 'border-b border-stone-100 dark:border-slate-800'}`}>
          <div className="flex items-center gap-2">
            <StatusDot tone={dotTone} />
            <span className={`font-medium text-slate-700 dark:text-slate-200 ${isSidebar ? 'text-[11px] leading-tight' : 'text-xs'}`}>
              {modeLabel || 'Detecting…'}
            </span>
          </div>

          {!isSidebar && taskMode && (
            <span className="rounded-full border border-teal-200/80 bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-800 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-200">
              {taskMode}
            </span>
          )}
          {!isSidebar && activeModel && (
            <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {activeModel}
            </span>
          )}
          {!isSidebar && memoryLine && (
            <span className="max-w-[12rem] truncate rounded-full border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              {memoryLine}
            </span>
          )}

          {!isSidebar && (
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
          )}
        </div>

        {isSidebar && (taskMode || activeModel) && (
          <div className="flex flex-wrap gap-1 border-b border-stone-100 px-3 py-2 dark:border-slate-800">
            {taskMode && (
              <span className="rounded-full border border-teal-200/80 bg-teal-50 px-2 py-0.5 text-[9px] font-medium text-teal-800 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-200">
                {taskMode}
              </span>
            )}
            {activeModel && (
              <span className="truncate rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[9px] text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {activeModel}
              </span>
            )}
          </div>
        )}

        {/* Backend connect (GitHub Pages / no API) — always show URL field in sidebar when offline */}
        {(showConnectForm || (isSidebar && !connected && !isStaticHosting())) && (
          <div className="border-b border-stone-100 px-3 py-3 dark:border-slate-800">
            {showConnectForm && (
              <p className="mb-2 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
                Offline chat works here. Connect API for PDFs, thinking modes &amp; sign-in.
              </p>
            )}
            <form onSubmit={handleConnect} className="flex flex-col gap-2">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={isSidebar ? 'http://localhost:3002' : 'https://tunnel… or http://localhost:3002'}
                className="w-full rounded-lg border border-stone-200 bg-stone-50/80 px-2.5 py-1.5 text-[11px] text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-100"
              />
              <button
                type="submit"
                disabled={status === 'checking'}
                className="w-full rounded-lg bg-teal-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-teal-700 disabled:opacity-60"
              >
                {status === 'checking' ? 'Connecting…' : 'Connect backend'}
              </button>
            </form>
            {error && (
              <p className="mt-2 text-[10px] text-red-600 dark:text-red-400">{error}</p>
            )}
          </div>
        )}

        {/* Connected backend URL */}
        {connected && getApiBase() && (
          <div className="border-b border-stone-100 px-3 py-2 dark:border-slate-800">
            <p className="truncate text-[9px] text-slate-400">
              API — <code className="text-slate-500">{getApiBase()}</code>
            </p>
            {isSidebar && (
              <button
                type="button"
                onClick={handleDisconnect}
                className="mt-1 text-[10px] font-medium text-teal-700 hover:underline dark:text-teal-400"
              >
                Disconnect
              </button>
            )}
          </div>
        )}

        {isSidebar && memoryLine && (
          <div className="flex items-center justify-between gap-2 border-b border-stone-100 px-3 py-2 dark:border-slate-800">
            <span className="truncate text-[9px] text-amber-800 dark:text-amber-200">{memoryLine}</span>
            {onClearMemory && (
              <button type="button" onClick={onClearMemory} className="shrink-0 text-[9px] text-slate-400 hover:text-red-500">
                Clear
              </button>
            )}
          </div>
        )}

        {notice && (
          <div className="bg-amber-50/60 px-3 py-2 dark:bg-amber-950/20">
            <p className="text-[10px] text-amber-900 dark:text-amber-200">{notice}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export { canReachBackend };
