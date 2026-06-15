import { BIG_O_REFERENCE } from '../../data/codeLibraryMeta.js';

export default function BigOReference({ open, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-stone-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Big-O Reference</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left dark:border-slate-700">
              <th className="pb-2 font-medium">Complexity</th>
              <th className="pb-2 font-medium">Example</th>
            </tr>
          </thead>
          <tbody>
            {BIG_O_REFERENCE.map((row) => (
              <tr key={row.complexity} className="border-b border-stone-100 dark:border-slate-800">
                <td className="py-2.5">
                  <span
                    className="rounded-full px-2.5 py-0.5 font-mono text-xs font-medium text-white"
                    style={{ backgroundColor: row.color }}
                  >
                    {row.complexity}
                  </span>
                </td>
                <td className="py-2.5 text-slate-600 dark:text-slate-300">{row.example}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
