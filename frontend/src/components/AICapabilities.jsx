const ICONS = {
  text: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
      <path d="M4 7h16M4 12h10M4 17h14" />
    </svg>
  ),
  embeddings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
      <circle cx="6" cy="6" r="2" /><circle cx="18" cy="6" r="2" />
      <circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" />
      <path d="M8 6h8M6 8v8M18 8v8M8 18h8" />
    </svg>
  ),
  rag: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
      <path d="M4 19V5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z" />
      <path d="M8 7h8M8 11h8M8 15h5" />
    </svg>
  ),
  finetune: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  ),
  multimodal: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
      <rect x="3" y="5" width="14" height="10" rx="1" />
      <path d="M7 19h10M12 15v4" />
      <circle cx="17" cy="8" r="3" />
    </svg>
  ),
  image: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="11" r="2" />
      <path d="M21 15l-5-5-4 4-2-2-5 5" />
    </svg>
  ),
  video: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
      <rect x="2" y="6" width="15" height="12" rx="2" />
      <path d="M17 10l5-3v10l-5-3z" />
    </svg>
  ),
  transcription: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
      <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4" />
    </svg>
  ),
  tts: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
      <path d="M11 5L6 9H3v6h3l5 4V5z" />
      <path d="M15 9a4 4 0 0 1 0 6M17 7a7 7 0 0 1 0 10" />
    </svg>
  ),
  voice: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
      <circle cx="12" cy="8" r="4" />
      <path d="M6 20v-1a6 6 0 0 1 12 0v1" />
      <path d="M9 12h6" />
    </svg>
  ),
  translation: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
      <path d="M5 8h8M5 12h5" />
      <path d="M14 8l3 8 3-8" />
      <path d="M15.5 11h3" />
    </svg>
  ),
  vla: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
      <rect x="4" y="8" width="16" height="10" rx="2" />
      <circle cx="9" cy="13" r="1.5" fill="currentColor" />
      <circle cx="15" cy="13" r="1.5" fill="currentColor" />
      <path d="M8 4h8M12 2v2" />
    </svg>
  ),
  ocr: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 8h8M8 12h6M8 16h4" />
    </svg>
  ),
  classify: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="3" width="8" height="8" rx="1" />
      <rect x="3" y="13" width="8" height="8" rx="1" />
      <rect x="13" y="13" width="8" height="8" rx="1" />
    </svg>
  ),
};

import { FALLBACK_CAPABILITIES } from '../data/capabilities.js';

function CapabilityIcon({ name }) {
  return <span className="text-teal-400">{ICONS[name] || ICONS.text}</span>;
}

function CapabilityCard({ capability, onTry }) {
  return (
    <button
      type="button"
      onClick={() => onTry(capability)}
      className="capability-card group rounded-xl border p-5 text-left transition-all hover:border-teal-300 hover:shadow-sm dark:hover:border-teal-600"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-500/10">
          <CapabilityIcon name={capability.icon} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-900 group-hover:text-teal-600 transition-colors dark:text-white dark:group-hover:text-teal-400">
            {capability.title}
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{capability.description}</p>
          <p className="mt-3 text-[10px] uppercase tracking-wider text-slate-400">{capability.backend}</p>
        </div>
      </div>
    </button>
  );
}

export default function AICapabilities({ capabilities, onTry }) {
  const items = capabilities?.length ? capabilities : FALLBACK_CAPABILITIES;

  return (
    <section className="px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">AI capabilities</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Full QVAC SDK suite — click any capability to try it via the API.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((cap) => (
            <CapabilityCard key={cap.id} capability={cap} onTry={onTry} />
          ))}
        </div>
      </div>
    </section>
  );
}
