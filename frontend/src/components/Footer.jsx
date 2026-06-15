export default function Footer({ onNavigate }) {
  const links = [
    { label: 'Install', id: 'install' },
    { label: 'User Guide', id: 'guide' },
    { label: 'API', id: 'api' },
    { label: 'Examples', id: 'examples' },
    { label: 'Community', id: 'community' },
  ];

  return (
    <footer className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
          {links.map((link) => (
            <button
              key={link.id}
              type="button"
              onClick={() => onNavigate?.(link.id)}
              className="text-slate-600 hover:text-teal-600 dark:text-slate-400 dark:hover:text-teal-400"
            >
              {link.label}
            </button>
          ))}
          <a
            href="https://docs.qvac.tether.io/"
            target="_blank"
            rel="noreferrer"
            className="text-slate-600 hover:text-teal-600 dark:text-slate-400"
          >
            QVAC Docs
          </a>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm font-medium">
          <a
            href="https://docs.qvac.tether.io/quickstart/"
            target="_blank"
            rel="noreferrer"
            className="text-teal-600 hover:underline dark:text-teal-400"
          >
            Quickstart
          </a>
          <span className="text-slate-300 dark:text-slate-600">|</span>
          <button
            type="button"
            onClick={() => onNavigate?.('api')}
            className="text-teal-600 hover:underline dark:text-teal-400"
          >
            Cite OWNAI
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          OWNAI · Local-first AI · Apache 2.0 · Built with Node.js, React, and @qvac/sdk
        </p>
      </div>
    </footer>
  );
}
