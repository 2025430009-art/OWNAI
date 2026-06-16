import { useState } from 'react';

function dotColor(score) {
  if (score > 80) return 'bg-emerald-500';
  if (score > 60) return 'bg-amber-500';
  return 'bg-red-500';
}

export default function ConfidenceDisplay({ confidence, confidenceDetail }) {
  const [open, setOpen] = useState(false);
  if (confidence?.score == null && confidence?.score !== 0) return null;

  const score = confidence.score;
  const detail = confidenceDetail || confidence.detail;
  const caveat = detail?.should_caveat ? detail.caveat_text : null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] text-slate-600 hover:bg-stone-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
        title={confidence.reasoning || 'Confidence score'}
      >
        <span className={`h-2 w-2 rounded-full ${dotColor(score)}`} />
        <span>{score}% confidence</span>
        <span className="text-slate-400">{open ? '▾' : '▸'}</span>
      </button>

      {open && detail?.dimensions && Object.keys(detail.dimensions).length > 0 && (
        <div className="mt-2 rounded-lg border border-stone-200 bg-stone-50 p-2 text-[11px] dark:border-slate-700 dark:bg-slate-900">
          {Object.entries(detail.dimensions).map(([key, dim]) => (
            <div key={key} className="mb-1.5 last:mb-0">
              <div className="flex items-center justify-between font-medium capitalize text-slate-700 dark:text-slate-200">
                <span>{key.replace(/_/g, ' ')}</span>
                <span>{dim.score}%</span>
              </div>
              {dim.reason && (
                <p className="text-slate-500 dark:text-slate-400">{dim.reason}</p>
              )}
            </div>
          ))}
          {detail.high_uncertainty_areas?.length > 0 && (
            <p className="mt-2 text-slate-500 dark:text-slate-400">
              Uncertain: {detail.high_uncertainty_areas.join('; ')}
            </p>
          )}
        </div>
      )}

      {caveat && (
        <p className="mt-1.5 text-xs italic text-slate-500 dark:text-slate-400">{caveat}</p>
      )}
    </div>
  );
}
