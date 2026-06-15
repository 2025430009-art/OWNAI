export default function UserGuidePage({ onNavigate }) {
  const sections = [
    {
      title: 'Architecture',
      body: 'OWNAI uses a three-layer stack: your app → QVAC JS SDK → edge inference engines (GGML, ONNX, Whisper). Models are fetched from a distributed registry or loaded locally.',
      action: () => onNavigate('architecture'),
      actionLabel: 'View architecture diagram',
    },
    {
      title: 'Text generation',
      body: 'Use the /api/v1/generate endpoint or @qvac/sdk completion() for chat and completion. Supports streaming, temperature, and max_tokens.',
    },
    {
      title: 'Capabilities',
      body: '14 built-in AI tasks: LLM, embeddings, RAG, ASR, TTS, diffusion, OCR, translation, VLA, and more. Each capability has a dedicated API route.',
      action: () => onNavigate('capabilities'),
      actionLabel: 'Browse all capabilities',
    },
    {
      title: 'Mobile & offline',
      body: 'The Expo app runs QVAC on physical devices. Toggle offline mode for on-device inference without cloud APIs.',
    },
    {
      title: 'Configuration',
      body: 'Set per-capability model sources in .env: LLM_MODEL_SRC, WHISPER_MODEL_SRC, TTS_MODEL_SRC, etc.',
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white">User Guide</h1>
      <p className="mt-4 text-slate-600 dark:text-slate-400">
        Learn how to use OWNAI for local AI inference across web, server, and mobile.
      </p>

      <nav className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">On this page</p>
        <ul className="mt-2 space-y-1 text-sm text-teal-600 dark:text-teal-400">
          {sections.map((s) => (
            <li key={s.title}>
              <a href={`#${s.title.toLowerCase().replace(/\s/g, '-')}`}>{s.title}</a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-10 space-y-10">
        {sections.map((s) => (
          <section key={s.title} id={s.title.toLowerCase().replace(/\s/g, '-')}>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{s.title}</h2>
            <p className="mt-3 leading-relaxed text-slate-600 dark:text-slate-400">{s.body}</p>
            {s.action && (
              <button
                type="button"
                onClick={s.action}
                className="mt-3 text-sm font-medium text-teal-600 hover:underline dark:text-teal-400"
              >
                {s.actionLabel} →
              </button>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
