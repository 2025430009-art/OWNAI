export default function ApiPage() {
  const endpoints = [
    { method: 'GET', path: '/api/v1/health', desc: 'Health check' },
    { method: 'POST', path: '/api/v1/generate', desc: 'Text generation' },
    { method: 'GET', path: '/api/v1/capabilities', desc: 'List all AI capabilities' },
    { method: 'POST', path: '/api/v1/capabilities/:slug/execute', desc: 'Run a capability' },
    { method: 'POST', path: '/v1/chat/completions', desc: 'OpenAI-compatible chat' },
    { method: 'GET', path: '/v1/models', desc: 'OpenAI-compatible model list' },
    { method: 'POST', path: '/api/v1/auth/signup', desc: 'Register user' },
    { method: 'POST', path: '/api/v1/auth/login', desc: 'Login' },
    { method: 'GET', path: '/api-docs', desc: 'Interactive Swagger documentation' },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white">API Reference</h1>
      <p className="mt-4 text-slate-600 dark:text-slate-400">
        REST API for all OWNAI capabilities. OpenAI-compatible endpoints at <code className="doc-inline">/v1</code>.
      </p>

      <div className="mt-8 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-900 dark:text-white">Method</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-900 dark:text-white">Endpoint</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-900 dark:text-white">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {endpoints.map((ep) => (
              <tr key={ep.path} className="bg-white dark:bg-slate-950">
                <td className="px-4 py-3">
                  <span className={`rounded px-2 py-0.5 text-xs font-mono font-semibold ${
                    ep.method === 'GET' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                  }`}>
                    {ep.method}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">{ep.path}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{ep.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-12 text-xl font-semibold text-slate-900 dark:text-white">Example</h2>
      <pre className="doc-code mt-4">{`curl -X POST http://localhost:3000/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "default",
    "messages": [{"role": "user", "content": "Hello OWNAI!"}],
    "max_tokens": 100
  }'`}</pre>

      <a
        href="http://localhost:3000/api-docs"
        target="_blank"
        rel="noreferrer"
        className="mt-6 inline-block text-sm font-medium text-teal-600 hover:underline dark:text-teal-400"
      >
        Open interactive Swagger docs →
      </a>
    </div>
  );
}
