import { useEffect, useState, useCallback } from 'react';
import { listMemories, forgetMemoryEntry } from '../../api/client.js';

const TYPE_COLORS = {
  fact: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200',
  preference: 'bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200',
  skill: 'bg-teal-100 text-teal-800 dark:bg-teal-950/50 dark:text-teal-200',
  project: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200',
  relationship: 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200',
};

export default function MemoryPanel({ open, onClose, user, onRecall }) {
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const data = await listMemories();
      setMemories(data.memories || []);
    } catch (err) {
      setError(err.message);
      setMemories([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const handleForget = async (id) => {
    try {
      await forgetMemoryEntry(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-stone-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-white">
            Your memories ({memories.length})
          </h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">×</button>
        </div>
        <div className="overflow-y-auto p-4">
          {!user && (
            <p className="text-sm text-slate-500">Sign in to view persistent memories.</p>
          )}
          {loading && <p className="text-sm text-slate-400">Loading…</p>}
          {error && <p className="text-sm text-red-500">{error}</p>}
          {!loading && memories.length === 0 && user && (
            <p className="text-sm text-slate-500">No memories stored yet. OWNAI learns as you chat.</p>
          )}
          <ul className="space-y-2">
            {memories.map((memory) => (
              <li
                key={memory.id}
                className="flex items-start gap-2 rounded-lg border border-stone-200 p-3 dark:border-slate-700"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TYPE_COLORS[memory.type] || TYPE_COLORS.fact}`}>
                      {memory.type}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {Math.round((memory.confidence || 0.8) * 100)}% conf
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-200">{memory.content}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleForget(memory.id)}
                  className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Forget memory"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="border-t border-stone-200 px-4 py-3 dark:border-slate-700">
          <button
            type="button"
            onClick={onRecall}
            className="mb-2 w-full rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-medium text-violet-800 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200"
          >
            What do you remember about me?
          </button>
          <p className="text-[11px] text-slate-400">
            Sends a chat message that recalls your stored memories in context.
          </p>
        </div>
      </div>
    </div>
  );
}

export function MemoryIndicator({ count, onClick, user }) {
  if (!user) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] font-medium text-violet-800 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200"
    >
      {count != null ? `${count} memories` : 'Memories'}
    </button>
  );
}
