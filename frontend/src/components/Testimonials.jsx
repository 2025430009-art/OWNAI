import { TESTIMONIALS } from '../data/domains.js';

export default function Testimonials() {
  return (
    <section className="border-t border-slate-200 bg-slate-50 py-12 dark:border-slate-800 dark:bg-slate-900/50">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Who uses OWNAI?</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <blockquote
              key={i}
              className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"
            >
              <p className="text-sm italic leading-relaxed text-slate-600 dark:text-slate-400">
                &ldquo;{t.quote}&rdquo;
              </p>
              <footer className="mt-3 text-xs font-semibold text-teal-600 dark:text-teal-400">
                — {t.org}
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
