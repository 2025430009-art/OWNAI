import { useState } from 'react';
import CodeBlock from './CodeBlock.jsx';
import ReferenceMarkdown from './ReferenceMarkdown.jsx';
import { LANGUAGE_COLORS, LANGUAGE_LABELS } from '../../data/codeLibraryMeta.js';
import { generateFileName } from '../../utils/codeParser.js';

function Badge({ label, color, className = '' }) {
  const style = color ? { backgroundColor: `${color}22`, color, borderColor: `${color}55` } : {};
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${className}`}
      style={style}
    >
      {label}
    </span>
  );
}

export default function CodeSnippetCard({ entry, onEdit, onDelete }) {
  const [descOpen, setDescOpen] = useState(false);
  const langColor = LANGUAGE_COLORS[entry.language] || '#64748b';
  const langLabel = LANGUAGE_LABELS[entry.language] || entry.language;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(entry.code);
    } catch {
      // ignore
    }
  };

  const downloadCode = () => {
    const blob = new Blob([entry.code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = generateFileName(entry.title, entry.language);
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = () => {
    if (window.confirm(`Delete "${entry.title}"?`)) onDelete(entry.id);
  };

  const longDesc = (entry.description || '').split('\n').length > 3 || (entry.description || '').length > 200;

  return (
    <article className="rounded-xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3 border-b border-stone-100 px-4 py-3 dark:border-slate-800">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">{entry.title}</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge label={langLabel} color={langColor} />
            {entry.category && <Badge label={entry.category} className="border-stone-200 bg-stone-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300" />}
            {entry.complexity?.time && <Badge label={entry.complexity.time} className="border-emerald-200 bg-emerald-50 text-emerald-700" />}
            {entry.complexity?.space && <Badge label={entry.complexity.space} className="border-sky-200 bg-sky-50 text-sky-700" />}
            {(entry.tags || []).map((tag) => (
              <Badge key={tag} label={tag} className="border-stone-200 bg-stone-50 text-slate-500" />
            ))}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <button type="button" onClick={copyCode} title="Copy code" className="rounded-md p-2 text-slate-400 hover:bg-stone-100 hover:text-slate-700 dark:hover:bg-slate-800">📋</button>
          <button type="button" onClick={downloadCode} title="Download" className="rounded-md p-2 text-slate-400 hover:bg-stone-100 hover:text-slate-700 dark:hover:bg-slate-800">⬇️</button>
          <button type="button" onClick={() => onEdit(entry)} title="Edit" className="rounded-md p-2 text-slate-400 hover:bg-stone-100 hover:text-slate-700 dark:hover:bg-slate-800">✏️</button>
          <button type="button" onClick={handleDelete} title="Delete" className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-500">🗑️</button>
        </div>
      </div>

      <div className="p-4">
        <CodeBlock code={entry.code} language={entry.language} />
        {entry.description && (
          <div className="mt-3">
            <div className={`text-sm text-slate-600 dark:text-slate-300 ${!descOpen && longDesc ? 'line-clamp-3' : ''}`}>
              <ReferenceMarkdown content={entry.description} />
            </div>
            {longDesc && (
              <button
                type="button"
                onClick={() => setDescOpen((o) => !o)}
                className="mt-1 text-xs text-teal-600 hover:text-teal-700"
              >
                {descOpen ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
