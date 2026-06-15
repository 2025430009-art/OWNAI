import DomainCard from '../components/DomainCard.jsx';
import NewsSection from '../components/NewsSection.jsx';
import Testimonials from '../components/Testimonials.jsx';
import { DOMAINS } from '../data/domains.js';

const VALUE_PROPS = [
  'Simple and efficient tools for on-device AI inference',
  'Accessible to everybody, and reusable across web, mobile, and server',
  'Built on QVAC SDK, GGML, ONNX, and Vulkan GPU acceleration',
  'Open source, commercially usable — Apache 2.0 license',
];

export default function HomePage({ onNavigate, onTryCapability }) {
  return (
    <div className="bg-white dark:bg-slate-950">
      {/* Hero — sklearn.org homepage */}
      <section className="sklearn-hero border-b border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-6xl px-4 py-14 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
            OWNAI
          </h1>
          <p className="mt-2 text-lg text-slate-600 sm:text-xl dark:text-slate-400">
            Local-first AI in JavaScript
          </p>

          <ul className="sklearn-bullets mx-auto mt-8 max-w-2xl text-left text-sm text-slate-700 dark:text-slate-300">
            {VALUE_PROPS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => onNavigate('install')}
              className="sklearn-btn-primary"
            >
              Getting Started
            </button>
            <button
              type="button"
              onClick={() => onNavigate('highlights')}
              className="sklearn-btn-secondary"
            >
              Release Highlights for 1.0
            </button>
          </div>
        </div>
      </section>

      {/* Main content: domain cards + sticky news */}
      <section className="py-12">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="grid gap-6 sm:grid-cols-2">
            {DOMAINS.map((domain) => (
              <DomainCard
                key={domain.id}
                domain={domain}
                onTry={(d) => onTryCapability?.({ slug: d.slug, title: d.title })}
                onExamples={() => onNavigate('examples')}
              />
            ))}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <NewsSection onNavigate={onNavigate} />
          </aside>
        </div>
      </section>

      {/* Sponsor / ecosystem strip */}
      <section className="border-y border-slate-200 bg-slate-50 py-10 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            OWNAI is made possible by{' '}
            <a
              href="https://docs.qvac.tether.io/"
              className="font-semibold text-teal-600 hover:underline dark:text-teal-400"
              target="_blank"
              rel="noreferrer"
            >
              QVAC
            </a>
            , open-source inference engines, and individuals committed to local AI.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('community')}
            className="mt-3 text-sm text-teal-600 hover:underline dark:text-teal-400"
          >
            Learn more about OWNAI&apos;s ecosystem →
          </button>
        </div>
      </section>

      <Testimonials />
    </div>
  );
}
