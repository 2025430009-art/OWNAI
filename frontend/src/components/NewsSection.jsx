import { NEWS } from '../data/domains.js';

export default function NewsSection({ onNavigate }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h3 className="border-b border-slate-200 pb-3 text-base font-bold text-slate-900 dark:border-slate-700 dark:text-white">
        News
      </h3>
      <ul className="mt-4 space-y-5">
        {NEWS.map((item, i) => (
          <li key={i}>
            <p className="text-sm leading-snug text-slate-800 dark:text-slate-200">
              <strong>{item.date}.</strong> {item.title}
              {item.detail && (
                <span className="block mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {item.detail}
                </span>
              )}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-5 border-t border-slate-100 pt-4 text-sm dark:border-slate-800">
        <strong className="text-slate-900 dark:text-white">All releases:</strong>{' '}
        <button
          type="button"
          onClick={() => onNavigate?.('highlights')}
          className="text-teal-600 hover:underline dark:text-teal-400"
        >
          What&apos;s new
        </button>
      </p>
    </div>
  );
}
