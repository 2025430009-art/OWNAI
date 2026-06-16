import { useState, useRef, useEffect } from 'react';
import { RESEARCH_CHAT_TEMPLATES } from '../utils/researchContentDetect.js';

export default function ResearchTemplatesMenu({ onSelect, disabled }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-medium text-violet-800 transition-colors hover:bg-violet-100 disabled:opacity-50 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200"
      >
        Research Templates
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-20 mb-2 w-72 rounded-xl border border-stone-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {RESEARCH_CHAT_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => {
                onSelect(template.prompt);
                setOpen(false);
              }}
              className="block w-full rounded-lg px-3 py-2 text-left text-xs text-slate-700 hover:bg-stone-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {template.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
