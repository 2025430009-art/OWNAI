export default function ReleaseHighlightsPage({ onNavigate }) {
  const highlights = [
    {
      version: '1.0.0',
      date: 'June 2026',
      items: [
        '14 AI capabilities via unified REST API and @qvac/sdk',
        'OpenAI-compatible /v1/chat/completions endpoint',
        'React web dashboard with sklearn-inspired documentation site',
        'Expo mobile app with offline on-device inference',
        'Docker Compose deployment with PostgreSQL auth',
        'Swagger API docs at /api-docs',
      ],
    },
    {
      version: '1.1.0',
      date: 'Roadmap',
      items: [
        'WebSocket token streaming',
        'Model marketplace for GGUF uploads',
        'Multi-GPU model distribution',
        'LoRA fine-tuning pipeline UI',
        'Usage analytics dashboard',
      ],
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Release Highlights</h1>
      <p className="mt-4 text-slate-600 dark:text-slate-400">
        What&apos;s new in OWNAI — local-first AI powered by QVAC.
      </p>

      {highlights.map((release) => (
        <section key={release.version} className="mt-10">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Version {release.version}
            <span className="ml-2 text-sm font-normal text-slate-500">({release.date})</span>
          </h2>
          <ul className="sklearn-bullets mt-4 text-slate-700 dark:text-slate-300">
            {release.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}

      <div className="mt-10 flex gap-4">
        <button type="button" onClick={() => onNavigate('install')} className="sklearn-btn-primary">
          Install OWNAI
        </button>
        <button type="button" onClick={() => onNavigate('examples')} className="sklearn-btn-secondary">
          Browse Examples
        </button>
      </div>

      <p className="mt-8 text-sm text-slate-500">
        <a href="#changelog" className="text-teal-600 hover:underline dark:text-teal-400">
          Full changelog
        </a>{' '}
        ·{' '}
        <button
          type="button"
          onClick={() => onNavigate('api')}
          className="text-teal-600 hover:underline dark:text-teal-400"
        >
          API reference
        </button>
      </p>
    </div>
  );
}
