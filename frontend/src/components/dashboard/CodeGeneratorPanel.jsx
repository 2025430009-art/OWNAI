import { useEffect, useState } from 'react';
import { listCodeGenerators, generateCode } from '../../api/client.js';

const LANGUAGE_COLORS = {
  javascript: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200',
  typescript: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  jsx: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200',
  python: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  sql: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
  html: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
  bash: 'bg-stone-200 text-stone-800 dark:bg-stone-700 dark:text-stone-200',
};

export default function CodeGeneratorPanel({ selectedModel }) {
  const [generators, setGenerators] = useState([]);
  const [activeId, setActiveId] = useState('javascript');
  const [prompt, setPrompt] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingList, setLoadingList] = useState(true);

  useEffect(() => {
    listCodeGenerators()
      .then((data) => {
        setGenerators(data.generators || []);
        if (data.generators?.[0]?.id) setActiveId(data.generators[0].id);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingList(false));
  }, []);

  const active = generators.find((g) => g.id === activeId);

  const handleGenerate = async (text = prompt) => {
    const trimmed = text.trim();
    if (!trimmed || loading || !activeId) return;

    setLoading(true);
    setError('');
    setOutput('');

    try {
      const response = await generateCode({
        generatorId: activeId,
        prompt: trimmed,
        max_tokens: 1024,
        model_key: selectedModel,
        stream: true,
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.token) {
              accumulated += parsed.token;
              setOutput(accumulated);
            }
          } catch {
            // skip malformed chunks
          }
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
  };

  if (loadingList) {
    return <p className="text-sm text-slate-400">Loading code generators…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Code generators</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
          Choose a language-specific generator powered by your local OWNAI backend.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {generators.map((gen) => (
          <button
            key={gen.id}
            type="button"
            onClick={() => setActiveId(gen.id)}
            className={`rounded-xl border p-4 text-left transition-colors ${
              activeId === gen.id
                ? 'border-teal-400 bg-teal-50/70 dark:border-teal-600 dark:bg-teal-950/40'
                : 'border-stone-200 bg-white hover:border-teal-200 dark:border-slate-700 dark:bg-slate-900'
            }`}
          >
            <span
              className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ${
                LANGUAGE_COLORS[gen.language] || 'bg-stone-100 text-stone-700'
              }`}
            >
              {gen.language}
            </span>
            <h3 className="mt-2 font-medium text-slate-800 dark:text-white">{gen.name}</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{gen.description}</p>
          </button>
        ))}
      </div>

      {active && (
        <div className="rounded-xl border border-stone-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs font-medium uppercase tracking-wide text-teal-600">
            {active.name} examples
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {active.examples.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => {
                  setPrompt(example);
                  handleGenerate(example);
                }}
                className="rounded-full border border-stone-200 px-3 py-1.5 text-xs text-slate-600 hover:border-teal-300 hover:bg-teal-50 dark:border-slate-600 dark:text-slate-300 dark:hover:border-teal-700"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-stone-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          What should OWNAI generate?
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder={active ? `Describe the ${active.name} code you need…` : 'Describe your code task…'}
          className="mt-2 w-full resize-none rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-slate-800 focus:border-teal-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleGenerate()}
            disabled={loading || !prompt.trim()}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {loading ? 'Generating…' : `Generate ${active?.name || 'code'}`}
          </button>
          {output && (
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm text-slate-600 hover:bg-stone-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Copy output
            </button>
          )}
        </div>
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      </div>

      {(output || loading) && (
        <div className="rounded-xl border border-stone-200 bg-slate-950 p-4 dark:border-slate-700">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Output {active?.extension ? `(${active.extension})` : ''}
            </span>
            {loading && <span className="text-xs text-teal-400">Streaming…</span>}
          </div>
          <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words font-mono text-sm text-slate-100">
            {output || ' '}
          </pre>
        </div>
      )}
    </div>
  );
}
