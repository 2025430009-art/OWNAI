export default function InstallPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Install</h1>
      <p className="mt-4 text-slate-600 dark:text-slate-400">
        Get OWNAI running locally in minutes. Requires Node.js v22+, Vulkan drivers, and npm.
      </p>

      <section className="mt-10 space-y-8">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">1. Clone & install</h2>
          <pre className="doc-code mt-3">{`cd "/path/to/OWN AI"
cp .env.example .env
npm install`}</pre>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">2. Verify Vulkan GPU</h2>
          <pre className="doc-code mt-3">{`sudo apt install vulkan-tools
vulkaninfo --summary`}</pre>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">3. Test QVAC SDK</h2>
          <pre className="doc-code mt-3">npm run test:qvac</pre>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">4. Start services</h2>
          <pre className="doc-code mt-3">{`npm run dev           # API → localhost:3000
npm run dev:frontend  # Web → localhost:5173`}</pre>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">5. Docker (optional)</h2>
          <pre className="doc-code mt-3">docker compose up -d</pre>
        </div>
      </section>

      <p className="mt-10 text-sm text-slate-500">
        See also:{' '}
        <a href="https://docs.qvac.tether.io/quickstart/" className="text-teal-600 hover:underline" target="_blank" rel="noreferrer">
          QVAC Quickstart
        </a>
      </p>
    </div>
  );
}
