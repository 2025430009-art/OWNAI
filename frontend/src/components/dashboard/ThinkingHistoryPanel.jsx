import { useEffect, useState, useCallback } from 'react';
import { listThinkingLogs, getThinkingLog, compareThinkingModes } from '../../api/client.js';
import ThinkingVisualizer from '../ThinkingVisualizer.jsx';
import { MODE_LABELS } from '../../constants/thinkingModes.js';

function formatTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function ThinkingHistoryPanel({ open, onClose, user }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [compareResults, setCompareResults] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const data = await listThinkingLogs();
      setLogs((data.logs || []).slice(0, 10));
    } catch (err) {
      setError(err.message);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const openLog = async (log) => {
    try {
      const data = await getThinkingLog(log.id);
      setSelected({
        ...log,
        parsed: data.log?.parsed_result,
        raw: data.log,
      });
      setCompareResults(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const runCompare = async (log) => {
    setComparing(true);
    setError('');
    try {
      const data = await compareThinkingModes(log.message, ['chain_of_thought', 'tree_of_thoughts', 'self_refine']);
      setCompareResults(data.results || []);
      setSelected({ ...log, compareMessage: log.message });
    } catch (err) {
      setError(err.message);
    } finally {
      setComparing(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-stone-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-white">Thinking history</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">×</button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden md:grid-cols-2">
          <div className="overflow-y-auto border-b border-stone-200 p-3 md:border-b-0 md:border-r dark:border-slate-700">
            {!user && <p className="text-sm text-slate-500">Sign in to view thinking logs.</p>}
            {loading && <p className="text-sm text-slate-400">Loading…</p>}
            {error && <p className="mb-2 text-sm text-red-500">{error}</p>}
            <ul className="space-y-1">
              {logs.map((log) => (
                <li key={log.id}>
                  <button
                    type="button"
                    onClick={() => openLog(log)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-stone-100 dark:hover:bg-slate-800 ${
                      selected?.id === log.id ? 'bg-teal-50 dark:bg-teal-950/30' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-slate-700 dark:text-slate-200">
                        {log.message?.slice(0, 48)}{(log.message?.length || 0) > 48 ? '…' : ''}
                      </span>
                      {log.confidence != null && (
                        <span className="shrink-0 text-[10px] text-slate-400">{log.confidence}%</span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-400">
                      <span>{MODE_LABELS[log.mode] || log.mode}</span>
                      <span>{formatTime(log.created_at)}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="overflow-y-auto p-3">
            {!selected && (
              <p className="text-sm text-slate-400">Select a session to view reasoning details.</p>
            )}
            {selected && !compareResults && (
              <>
                <div className="mb-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={comparing}
                    onClick={() => runCompare(selected)}
                    className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800 hover:bg-teal-100 disabled:opacity-50 dark:border-teal-800 dark:bg-teal-950/40"
                  >
                    {comparing ? 'Comparing…' : 'Compare modes'}
                  </button>
                </div>
                {selected.parsed && (
                  <ThinkingVisualizer
                    thinkingResult={{
                      ...selected.parsed,
                      thinking_mode: selected.parsed.thinking_mode || selected.mode,
                      confidence_overall: selected.confidence,
                    }}
                    hideFinalAnswer={false}
                  />
                )}
              </>
            )}
            {compareResults && (
              <div className="space-y-3">
                <p className="text-xs font-medium text-slate-500">Side-by-side comparison</p>
                {compareResults.map((result) => (
                  <div key={result.mode} className="rounded-lg border border-stone-200 p-3 dark:border-slate-700">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-semibold text-teal-700 dark:text-teal-300">
                        {MODE_LABELS[result.mode] || result.mode}
                      </span>
                      {result.confidence != null && (
                        <span className="text-[10px] text-slate-400">{result.confidence}%</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                      {result.answer?.slice(0, 400)}{(result.answer?.length || 0) > 400 ? '…' : ''}
                    </p>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setCompareResults(null)}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  ← Back to log detail
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ThinkingHistorySidebar({ logs, onSelect, onOpenPanel }) {
  const preview = (logs || []).slice(0, 10);
  if (!preview.length) return null;

  return (
    <div className="mt-4 px-2">
      <div className="mb-2 flex items-center justify-between px-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Thinking history
        </p>
        <button
          type="button"
          onClick={onOpenPanel}
          className="text-[10px] text-teal-600 hover:underline dark:text-teal-400"
        >
          View all
        </button>
      </div>
      <ul className="space-y-0.5">
        {preview.map((log) => (
          <li key={log.id}>
            <button
              type="button"
              onClick={() => onSelect?.(log)}
              className="w-full truncate rounded-lg px-3 py-1.5 text-left text-xs text-slate-600 hover:bg-stone-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              {log.message?.slice(0, 36)}…
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
