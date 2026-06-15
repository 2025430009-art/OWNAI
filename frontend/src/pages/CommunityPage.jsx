export default function CommunityPage() {
  const links = [
    { title: 'QVAC Documentation', url: 'https://docs.qvac.tether.io/', desc: 'Official SDK reference and guides' },
    { title: 'QVAC Quickstart', url: 'https://docs.qvac.tether.io/quickstart/', desc: 'Get started with @qvac/sdk' },
    { title: 'API Reference', url: 'https://docs.qvac.tether.io/reference/api/', desc: 'Full QVAC function reference' },
    { title: 'GitHub', url: 'https://github.com', desc: 'Source code and issue tracker' },
    { title: 'scikit-learn', url: 'https://scikit-learn.org/stable/', desc: 'Inspiration for this documentation site' },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Community</h1>
      <p className="mt-4 text-slate-600 dark:text-slate-400">
        Connect with the OWNAI and QVAC ecosystem.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Resources</h2>
        <ul className="mt-4 space-y-4">
          {links.map((link) => (
            <li key={link.title}>
              <a
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-lg border border-slate-200 p-4 transition-colors hover:border-teal-300 hover:bg-teal-50/50 dark:border-slate-700 dark:hover:border-teal-700 dark:hover:bg-teal-950/20"
              >
                <p className="font-medium text-teal-600 dark:text-teal-400">{link.title}</p>
                <p className="mt-1 text-sm text-slate-500">{link.desc}</p>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Contributing</h2>
        <p className="mt-3 text-slate-600 dark:text-slate-400">
          OWNAI is open source under Apache 2.0. Contributions welcome — backend, frontend, mobile,
          documentation, and examples.
        </p>
      </section>

      <section id="roadmap" className="mt-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Roadmap</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-600 dark:text-slate-400">
          <li>Model marketplace — upload and share GGUF models</li>
          <li>WebSocket token streaming</li>
          <li>Multi-GPU model distribution</li>
          <li>LoRA fine-tuning pipeline</li>
          <li>Analytics dashboard</li>
        </ul>
      </section>
    </div>
  );
}
