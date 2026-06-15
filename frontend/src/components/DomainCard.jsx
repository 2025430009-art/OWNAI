const VISUALS = {
  llm: (
    <svg viewBox="0 0 200 120" className="w-full h-full">
      <rect x="20" y="30" width="160" height="60" rx="6" fill="#e0f2f1" stroke="#0d9488" strokeWidth="1.5" />
      <text x="30" y="55" fontSize="10" fill="#0d9488" fontFamily="monospace">Hello, OWNAI!</text>
      <text x="30" y="72" fontSize="9" fill="#64748b" fontFamily="monospace">▌ generating...</text>
      <circle cx="170" cy="45" r="8" fill="#14b8a6" opacity="0.3" />
    </svg>
  ),
  speech: (
    <svg viewBox="0 0 200 120" className="w-full h-full">
      <path d="M40 60 Q60 30 100 60 Q140 90 160 60" fill="none" stroke="#0d9488" strokeWidth="2" />
      <path d="M40 70 Q70 40 100 70 Q130 100 160 70" fill="none" stroke="#14b8a6" strokeWidth="1.5" opacity="0.6" />
      <rect x="85" y="45" width="30" height="40" rx="15" fill="#e0f2f1" stroke="#0d9488" strokeWidth="1.5" />
    </svg>
  ),
  vision: (
    <svg viewBox="0 0 200 120" className="w-full h-full">
      <rect x="50" y="25" width="100" height="70" rx="4" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1" />
      <circle cx="85" cy="55" r="12" fill="#e0f2f1" stroke="#0d9488" strokeWidth="1.5" />
      <rect x="110" y="45" width="30" height="4" rx="1" fill="#cbd5e1" />
      <rect x="110" y="55" width="25" height="4" rx="1" fill="#cbd5e1" />
      <rect x="110" y="65" width="20" height="4" rx="1" fill="#0d9488" opacity="0.5" />
    </svg>
  ),
  diffusion: (
    <svg viewBox="0 0 200 120" className="w-full h-full">
      <defs>
        <linearGradient id="dg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5eead4" />
          <stop offset="100%" stopColor="#0d9488" />
        </linearGradient>
      </defs>
      <rect x="55" y="20" width="90" height="80" rx="4" fill="url(#dg)" opacity="0.7" />
      <circle cx="80" cy="50" r="15" fill="#fff" opacity="0.3" />
      <path d="M60 85 L90 60 L120 75 L145 50" fill="none" stroke="#fff" strokeWidth="2" opacity="0.5" />
    </svg>
  ),
  rag: (
    <svg viewBox="0 0 200 120" className="w-full h-full">
      <circle cx="60" cy="60" r="8" fill="#0d9488" />
      <circle cx="100" cy="40" r="6" fill="#14b8a6" opacity="0.7" />
      <circle cx="140" cy="65" r="7" fill="#0d9488" opacity="0.5" />
      <circle cx="100" cy="80" r="5" fill="#14b8a6" opacity="0.4" />
      <line x1="60" y1="60" x2="100" y2="40" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 2" />
      <line x1="100" y1="40" x2="140" y2="65" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 2" />
      <line x1="60" y1="60" x2="100" y2="80" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 2" />
    </svg>
  ),
  platform: (
    <svg viewBox="0 0 200 120" className="w-full h-full">
      <rect x="30" y="70" width="40" height="30" rx="3" fill="#e0f2f1" stroke="#0d9488" strokeWidth="1" />
      <rect x="80" y="50" width="40" height="50" rx="3" fill="#e0f2f1" stroke="#0d9488" strokeWidth="1" />
      <rect x="130" y="35" width="40" height="65" rx="3" fill="#ccfbf1" stroke="#0d9488" strokeWidth="1.5" />
      <path d="M50 70 L100 50 L150 35" fill="none" stroke="#0d9488" strokeWidth="1.5" strokeDasharray="4 3" />
    </svg>
  ),
};

export default function DomainCard({ domain, onTry, onExamples }) {
  return (
    <article className="domain-card group flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
      <div className="border-b border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
        <div className="h-28">{VISUALS[domain.visual]}</div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{domain.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          {domain.description}
        </p>
        <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
          <strong className="font-semibold text-slate-900 dark:text-white">Applications:</strong>{' '}
          {domain.applications}
        </p>
        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
          <strong className="font-semibold text-slate-900 dark:text-white">Backends:</strong>{' '}
          {domain.backends}
        </p>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={() => onTry?.(domain)}
            className="text-sm font-medium text-teal-600 hover:text-teal-800 dark:text-teal-400"
          >
            Try it →
          </button>
          <button
            type="button"
            onClick={() => onExamples?.(domain)}
            className="text-sm text-slate-500 underline-offset-2 hover:text-teal-600 hover:underline dark:hover:text-teal-400"
          >
            Examples
          </button>
        </div>
      </div>
    </article>
  );
}
