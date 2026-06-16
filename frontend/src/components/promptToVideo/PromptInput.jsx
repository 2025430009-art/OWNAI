const EXAMPLES = [
  'Create a 5 minute video about Hanuman crossing the ocean to Lanka',
  '5 minute documentary about the solar system',
  'Motivational video about success',
];

export default function PromptInput({
  prompt,
  onChange,
  onSubmit,
  onExample,
  loading,
  examples = EXAMPLES,
  qualities = [],
  quality = '1080p',
  onQualityChange,
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-teal-600">
          Text to Video Generator
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
          Turn words into a 5-minute video
        </h1>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Claude writes the script · Stability paints each scene · ElevenLabs narrates · FFmpeg assembles your MP4
        </p>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <label className="block">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Step 1 — Enter your prompt
          </span>
          <textarea
            value={prompt}
            onChange={(e) => onChange(e.target.value)}
            rows={5}
            disabled={loading}
            placeholder="e.g. Create a 5 minute video about the solar system with dramatic narration…"
            className="input-field mt-3 min-h-[140px] resize-y text-base"
          />
        </label>

        <div className="mt-4 flex flex-wrap gap-2">
          {examples.map((ex) => (
            <button
              key={ex}
              type="button"
              disabled={loading}
              onClick={() => onExample?.(ex)}
              className="rounded-full border border-stone-200 px-3 py-1 text-xs text-slate-600 transition hover:border-teal-400 hover:text-teal-700 disabled:opacity-50 dark:border-slate-600 dark:text-slate-400"
            >
              {ex.length > 40 ? `${ex.slice(0, 40)}…` : ex}
            </button>
          ))}
        </div>

        {qualities.length > 0 && (
          <div className="mt-5">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Video quality</span>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {qualities.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  disabled={loading}
                  onClick={() => onQualityChange?.(q.id)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                    quality === q.id
                      ? 'border-teal-400 bg-teal-50 text-teal-800 dark:border-teal-600 dark:bg-teal-950/40 dark:text-teal-200'
                      : 'border-stone-200 text-slate-600 hover:border-teal-200 dark:border-slate-600 dark:text-slate-400'
                  }`}
                >
                  {q.label || q.id}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onSubmit}
          disabled={loading || !prompt.trim()}
          className="btn-primary mt-6 w-full py-3 text-base disabled:opacity-50"
        >
          {loading ? 'Generating your video…' : 'Generate 5-minute video'}
        </button>
      </div>
    </div>
  );
}
