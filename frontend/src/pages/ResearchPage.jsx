import { useState } from 'react';
import useResearchProject from '../hooks/useResearchProject.js';
import { createResearchProject } from '../api/client.js';

export default function ResearchPage({ user, onNavigate, onSignIn }) {
  const { project, projects, activeCount, loading, error, refresh, setActiveProject } = useResearchProject();
  const [title, setTitle] = useState('');
  const [domain, setDomain] = useState('approximate_computing');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    setFormError('');
    try {
      await createResearchProject({
        title: title.trim(),
        domain,
        research_question: 'Approximate computing for VVC transforms',
        target_journal: 'IEEE TCSVT',
      });
      setTitle('');
      await refresh();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setCreating(false);
    }
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Research Papers</h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          Sign in to manage IEEE research projects, literature, derivations, and simulations.
        </p>
        <button
          type="button"
          onClick={() => onSignIn?.()}
          className="btn-primary mt-6 px-6 py-2"
        >
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Research</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            IEEE paper pipeline — literature, math, MATLAB/Python/Verilog, LaTeX
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate?.('playground')}
          className="rounded-lg border border-teal-200 px-4 py-2 text-sm text-teal-700 hover:bg-teal-50 dark:border-teal-800 dark:text-teal-300"
        >
          Open in chat
        </button>
      </div>

      {loading && (
        <p className="mt-8 text-sm text-slate-500">Loading research projects…</p>
      )}

      {error && (
        <p className="mt-8 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      )}

      {!loading && !error && (
        <>
          <section className="mt-8 rounded-xl border border-stone-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Active projects</h2>
            <p className="mt-1 text-2xl font-bold text-teal-700 dark:text-teal-400">{activeCount}</p>

            {projects.length > 0 ? (
              <ul className="mt-4 space-y-2">
                {projects.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setActiveProject(item.id)}
                      className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
                        project?.id === item.id
                          ? 'border-teal-300 bg-teal-50 dark:border-teal-700 dark:bg-teal-950/30'
                          : 'border-stone-200 hover:bg-stone-50 dark:border-slate-700 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{item.title}</p>
                        <p className="text-xs text-slate-500">{item.domain || 'general'} · phase {item.phase ?? 0}</p>
                      </div>
                      {project?.id === item.id && (
                        <span className="text-xs font-medium text-teal-700 dark:text-teal-300">Active</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-slate-500">No active projects yet. Create one below.</p>
            )}
          </section>

          {project && (
            <section className="mt-6 rounded-xl border border-stone-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{project.title}</h2>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Research question</dt>
                  <dd className="text-slate-800 dark:text-slate-200">{project.research_question || '—'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Target journal</dt>
                  <dd className="text-slate-800 dark:text-slate-200">{project.target_journal || '—'}</dd>
                </div>
              </dl>
              <p className="mt-4 text-xs text-slate-500">
                Use chat with research keywords (IEEE, MATLAB, theorem, BD-rate) — OWNAI auto-loads this project context.
              </p>
            </section>
          )}

          <section className="mt-6 rounded-xl border border-stone-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">New project</h2>
            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-400">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input-field mt-1 w-full"
                  placeholder="LOA-based approximate VVC transforms"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-400">Domain</label>
                <select
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="input-field mt-1 w-full"
                >
                  <option value="approximate_computing">Approximate computing</option>
                  <option value="vlsi">VLSI</option>
                  <option value="video_coding">Video coding</option>
                  <option value="dsp">DSP</option>
                </select>
              </div>
              {formError && (
                <p className="text-sm text-red-600">{formError}</p>
              )}
              <button type="submit" disabled={creating || !title.trim()} className="btn-primary px-5 py-2">
                {creating ? 'Creating…' : 'Create project'}
              </button>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
