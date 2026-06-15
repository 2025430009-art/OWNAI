import { useState, useEffect } from 'react';
import {
  getApiBase,
  setApiBase,
  clearApiBase,
  probeBackend,
  isStaticHosting,
  detectAIMode,
  getModeLabel,
  AI_MODES,
} from '../../utils/apiConfig.js';

export default function BackendConnectPanel({ onConnected, compact = false }) {
  const [url, setUrl] = useState(() => getApiBase());
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(() => Boolean(getApiBase()));
  const [mode, setMode] = useState(AI_MODES.STATIC);
  const [modeLabel, setModeLabel] = useState('');

  useEffect(() => {
    detectAIMode().then((m) => {
      setMode(m);
      setModeLabel(getModeLabel(m));
    });
  }, [connected, status]);

  const handleConnect = async (e) => {
    e?.preventDefault();
    setError('');
    setStatus('checking');

    try {
      const base = setApiBase(url);
      await probeBackend(base);
      setConnected(true);
      setStatus('connected');
      const m = await detectAIMode();
      setMode(m);
      setModeLabel(getModeLabel(m));
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
    setUrl('');
    onConnected?.('');
    detectAIMode().then((m) => setModeLabel(getModeLabel(m)));
  };

  const showBackendForm = isStaticHosting() && !connected;

  return (
    <div className={`mx-auto max-w-2xl space-y-2 ${compact ? '' : 'mb-3'}`}>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 bg-white/80 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900/80">
        <span className="font-medium text-slate-500">AI mode</span>
        <span className={`rounded-full px-2.5 py-0.5 font-medium ${
          mode === AI_MODES.LOCAL
            ? 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200'
            : mode === AI_MODES.BACKEND
              ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200'
              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
        }`}>
          {modeLabel || 'Detecting…'}
        </span>
        {mode === AI_MODES.STATIC && (
          <span className="text-slate-400">Chat works offline — connect backend for full AI</span>
        )}
      </div>

      {connected && status === 'connected' && (
        <div className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900 dark:border-teal-800 dark:bg-teal-950/50 dark:text-teal-100">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Backend — <code className="rounded bg-white/60 px-1.5 py-0.5 text-xs dark:bg-black/20">{getApiBase()}</code>
            </span>
            <button type="button" onClick={handleDisconnect} className="text-xs font-medium text-teal-700 underline dark:text-teal-300">
              Disconnect
            </button>
          </div>
        </div>
      )}

      {showBackendForm && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          <p className="font-medium">Connect OWNAI backend (optional)</p>
          <p className="mt-1 text-amber-900/80 dark:text-amber-200/80">
            Offline chat works now. Add a backend URL for full inference and attachments.
          </p>

          <form onSubmit={handleConnect} className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://localhost:3001"
              className="min-w-0 flex-1 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-teal-500 focus:outline-none dark:border-amber-800 dark:bg-slate-900 dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={status === 'checking'}
              className="shrink-0 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
            >
              {status === 'checking' ? 'Connecting…' : 'Connect'}
            </button>
          </form>

          {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}
