import { THINKING_MODE_OPTIONS } from '../../constants/thinkingModes.js';

export default function ThinkingModeSelector({ value = 'auto', onChange, disabled = false, compact = false }) {
  return (
    <div
      className={`flex flex-wrap items-center gap-1 ${compact ? '' : 'px-1'}`}
      role="group"
      aria-label="Thinking mode"
    >
      {THINKING_MODE_OPTIONS.map((opt) => {
        const selected = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            title={opt.tooltip}
            disabled={disabled}
            onClick={() => onChange?.(opt.id)}
            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors disabled:opacity-40 ${
              selected
                ? 'border-teal-500 bg-teal-50 text-teal-800 dark:border-teal-600 dark:bg-teal-950/50 dark:text-teal-200'
                : 'border-stone-200 bg-white text-slate-500 hover:border-stone-300 hover:text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
