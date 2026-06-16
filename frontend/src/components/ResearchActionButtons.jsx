import { detectResearchActions } from '../utils/researchContentDetect.js';
import useResearchActions from '../hooks/useResearchActions.js';

export default function ResearchActionButtons({ content, projectId, isStreaming }) {
  const actions = detectResearchActions(content);
  const { run, status, busy } = useResearchActions(projectId);

  if (isStreaming || !actions.length) return null;

  return (
    <div className="mt-3 space-y-2 border-t border-stone-200 pt-3 dark:border-slate-600">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
        Research actions
      </p>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            disabled={busy || !projectId}
            onClick={() => run(action.id, content)}
            className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-[11px] font-medium text-teal-800 transition-colors hover:bg-teal-100 disabled:opacity-50 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-200"
            title={projectId ? action.label : 'Select a research project first'}
          >
            {action.label}
          </button>
        ))}
      </div>
      {!projectId && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400">
          Open Research to create or select a project before saving.
        </p>
      )}
      {status && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{status}</p>
      )}
    </div>
  );
}
