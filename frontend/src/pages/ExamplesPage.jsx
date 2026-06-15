import { FALLBACK_CAPABILITIES } from '../data/capabilities.js';

export default function ExamplesPage({ onTryCapability }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Examples</h1>
      <p className="mt-4 text-slate-600 dark:text-slate-400">
        Runnable examples for each AI capability. Click to open the interactive demo.
      </p>

      <div className="mt-10 space-y-6">
        {FALLBACK_CAPABILITIES.map((cap) => (
          <article
            key={cap.id}
            className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">{cap.title}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{cap.description}</p>
                <p className="mt-2 text-xs text-slate-500">
                  <strong>Backend:</strong> {cap.backend}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onTryCapability(cap)}
                className="shrink-0 rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
              >
                Run
              </button>
            </div>
            <pre className="doc-code mt-4 text-xs">{`POST /api/v1/capabilities/${cap.slug}/execute`}</pre>
          </article>
        ))}
      </div>
    </div>
  );
}
