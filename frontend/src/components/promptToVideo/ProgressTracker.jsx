const STEPS_FALLBACK = [
  { id: 1, key: 'script', name: 'Claude AI — Script', icon: '📝' },
  { id: 2, key: 'images', name: 'Stability AI — Scene Images', icon: '🎨' },
  { id: 3, key: 'voiceover', name: 'ElevenLabs — Voiceover', icon: '🎙️' },
  { id: 4, key: 'combine', name: 'FFmpeg — Combine Video', icon: '⚡' },
  { id: 5, key: 'export', name: 'Export MP4', icon: '🎬' },
  { id: 6, key: 'deliver', name: 'Deliver to User', icon: '✅' },
];

export default function ProgressTracker({
  steps = STEPS_FALLBACK,
  currentStep,
  progress,
  scenePreviews,
  wsStatus = 'idle',
}) {
  const activeIndex = steps.findIndex((s) => s.key === currentStep);

  const wsLabel = {
    idle: null,
    connecting: 'Connecting…',
    connected: 'Live',
    reconnecting: 'Reconnecting…',
    error: 'WS fallback to SSE',
    unavailable: 'SSE only',
  }[wsStatus];

  const wsColor = {
    connecting: 'bg-amber-400',
    connected: 'bg-emerald-500',
    reconnecting: 'bg-amber-400 animate-pulse',
    error: 'bg-red-400',
    unavailable: 'bg-slate-400',
  }[wsStatus];

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
            Overall progress
            {wsLabel && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <span className={`h-1.5 w-1.5 rounded-full ${wsColor}`} />
                {wsLabel}
              </span>
            )}
          </span>
          <span className="text-teal-600">{progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-slate-700">
          <div
            className="h-full rounded-full bg-teal-600 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <ol className="space-y-3">
        {steps.map((step, index) => {
          const isActive = step.key === currentStep;
          const isDone = activeIndex >= 0 && index < activeIndex;
          return (
            <li
              key={step.key}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                isActive
                  ? 'border-teal-300 bg-teal-50/80 dark:border-teal-700 dark:bg-teal-950/40'
                  : isDone
                    ? 'border-stone-200 bg-white opacity-80 dark:border-slate-700 dark:bg-slate-900'
                    : 'border-stone-200 bg-white dark:border-slate-700 dark:bg-slate-900'
              }`}
            >
              <span className="text-xl" aria-hidden="true">{step.icon}</span>
              <div className="flex-1">
                <p className={`text-sm font-medium ${isActive ? 'text-teal-800 dark:text-teal-200' : 'text-slate-700 dark:text-slate-300'}`}>
                  {step.name}
                </p>
                {step.duration && (
                  <p className="text-xs text-slate-400">~{step.duration}</p>
                )}
              </div>
              {isDone && <span className="text-teal-600 text-sm">✓</span>}
              {isActive && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
              )}
            </li>
          );
        })}
      </ol>

      {scenePreviews > 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {scenePreviews} of 10 scene images generated…
        </p>
      )}
    </div>
  );
}
