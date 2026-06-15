import { useState, useEffect, useCallback, useMemo } from 'react';
import CodeEditor from './CodeEditor.jsx';
import CodeSnippetCard from './CodeSnippetCard.jsx';
import BigOReference from './BigOReference.jsx';
import { LANGUAGES, LANGUAGE_LABELS, CATEGORIES } from '../../data/codeLibraryMeta.js';
import { detectLanguage, extractComplexity, generateFileName } from '../../utils/codeParser.js';
import { exportLibraryZip } from '../../utils/zipExport.js';
import {
  listCodeLibrary,
  saveCodeLibraryEntry,
  updateCodeLibraryEntry,
  deleteCodeLibraryEntry,
  searchCodeLibrary,
} from '../../api/client.js';

const EMPTY_FORM = {
  title: '',
  description: '',
  code: '',
  language: 'python',
  category: 'General',
  tags: '',
  timeComplexity: '',
  spaceComplexity: '',
};

export default function CodeLibraryPanel() {
  const [entries, setEntries] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [langFilter, setLangFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sort, setSort] = useState('newest');
  const [showBigO, setShowBigO] = useState(false);
  const [formOpen, setFormOpen] = useState(true);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { sort };
      if (langFilter) params.lang = langFilter;
      if (categoryFilter) params.type = categoryFilter;
      if (search.trim()) params.q = search.trim();

      const data = search.trim()
        ? await searchCodeLibrary(search.trim(), params)
        : await listCodeLibrary(params);

      setEntries(data.entries || []);
      if (!search && !langFilter && !categoryFilter) {
        const all = await listCodeLibrary({ sort: 'newest' });
        setTotalCount(all.count ?? all.entries?.length ?? 0);
      }
    } catch (err) {
      setError(err.message);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [search, langFilter, categoryFilter, sort]);

  useEffect(() => {
    const t = setTimeout(loadEntries, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [loadEntries, search]);

  const resultLabel = useMemo(() => {
    const shown = entries.length;
    const total = totalCount || shown;
    return `Showing ${shown} of ${total} snippet${total === 1 ? '' : 's'}`;
  }, [entries.length, totalCount]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const handleCodeChange = (code) => {
    setForm((f) => {
      const detected = detectLanguage(code);
      const complexity = extractComplexity(f.description);
      return {
        ...f,
        code,
        language: f.language === 'python' && code.trim() ? detected : f.language,
        timeComplexity: f.timeComplexity || complexity.time,
        spaceComplexity: f.spaceComplexity || complexity.space,
      };
    });
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.code.trim()) {
      setError('Title and code are required');
      return;
    }
    setSaving(true);
    setError('');
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      code: form.code,
      language: form.language,
      category: form.category,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      complexity: {
        time: form.timeComplexity.trim(),
        space: form.spaceComplexity.trim(),
      },
    };
    try {
      if (editingId) {
        const { entry } = await updateCodeLibraryEntry(editingId, payload);
        setEntries((prev) => prev.map((e) => (e.id === entry.id ? entry : e)));
      } else {
        const { entry } = await saveCodeLibraryEntry(payload);
        setEntries((prev) => [entry, ...prev]);
        setTotalCount((c) => c + 1);
      }
      resetForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (entry) => {
    setEditingId(entry.id);
    setForm({
      title: entry.title,
      description: entry.description || '',
      code: entry.code,
      language: entry.language,
      category: entry.category || 'General',
      tags: (entry.tags || []).join(', '),
      timeComplexity: entry.complexity?.time || '',
      spaceComplexity: entry.complexity?.space || '',
    });
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    try {
      await deleteCodeLibraryEntry(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      setTotalCount((c) => Math.max(0, c - 1));
      if (editingId === id) resetForm();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleExport = async () => {
    try {
      const { entries: all } = await listCodeLibrary({ sort: 'newest' });
      if (!all?.length) {
        setError('No snippets to export');
        return;
      }
      exportLibraryZip(all);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#FAFAFA] dark:bg-slate-950">
      <div className="sticky top-0 z-10 border-b border-stone-200 bg-[#FAFAFA]/95 px-4 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Code &amp; Algorithm Library</h1>
              <p className="mt-1 text-sm text-slate-500">Developer reference for OWNAI-generated code and algorithms</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowBigO(true)}
                className="rounded-lg border border-stone-200 px-3 py-2 text-sm text-slate-600 hover:bg-white dark:border-slate-700 dark:text-slate-300"
              >
                Big-O Reference
              </button>
              <button
                type="button"
                onClick={handleExport}
                className="rounded-lg border border-stone-200 px-3 py-2 text-sm text-slate-600 hover:bg-white dark:border-slate-700 dark:text-slate-300"
              >
                Export Library
              </button>
              <button
                type="button"
                onClick={() => setFormOpen((o) => !o)}
                className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700"
              >
                {formOpen ? 'Hide form' : 'Add code'}
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, tags, code…"
              className="min-w-[180px] flex-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
            <select
              value={langFilter}
              onChange={(e) => setLangFilter(e.target.value)}
              className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">All languages</option>
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>{LANGUAGE_LABELS[l]}</option>
              ))}
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="az">A–Z</option>
            </select>
          </div>
          <p className="mt-2 text-xs text-slate-400">{resultLabel}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-5xl space-y-6">
          {formOpen && (
            <section className="rounded-xl border border-stone-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
              <h2 className="mb-4 text-sm font-semibold text-slate-800 dark:text-white">
                {editingId ? 'Edit snippet' : 'Add new code'}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Title — e.g. Binary Search in Python"
                  className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                />
                <select
                  value={form.language}
                  onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
                  className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>{LANGUAGE_LABELS[l]}</option>
                  ))}
                </select>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={form.tags}
                  onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                  placeholder="Tags — recursion, O(log n)"
                  className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                />
                <input
                  type="text"
                  value={form.timeComplexity}
                  onChange={(e) => setForm((f) => ({ ...f, timeComplexity: e.target.value }))}
                  placeholder="Time — O(n log n)"
                  className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                />
                <input
                  type="text"
                  value={form.spaceComplexity}
                  onChange={(e) => setForm((f) => ({ ...f, spaceComplexity: e.target.value }))}
                  placeholder="Space — O(1)"
                  className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                />
              </div>
              <textarea
                value={form.description}
                onChange={(e) => {
                  const description = e.target.value;
                  const complexity = extractComplexity(description);
                  setForm((f) => ({
                    ...f,
                    description,
                    timeComplexity: f.timeComplexity || complexity.time,
                    spaceComplexity: f.spaceComplexity || complexity.space,
                  }));
                }}
                placeholder="Short description (markdown supported)"
                rows={2}
                className="mt-3 w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              />
              <div className="mt-3">
                <CodeEditor value={form.code} onChange={handleCodeChange} language={form.language} />
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg bg-teal-600 px-5 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : editingId ? 'Update' : 'Save to Library'}
                </button>
                {editingId && (
                  <button type="button" onClick={resetForm} className="rounded-lg border border-stone-200 px-4 py-2 text-sm dark:border-slate-600">
                    Cancel
                  </button>
                )}
              </div>
              {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
            </section>
          )}

          {loading && <p className="text-center text-sm text-slate-400">Loading library…</p>}
          {!loading && entries.length === 0 && (
            <p className="text-center text-sm text-slate-400">No code snippets yet. Add your first entry above.</p>
          )}
          {entries.map((entry) => (
            <CodeSnippetCard key={entry.id} entry={entry} onEdit={handleEdit} onDelete={handleDelete} />
          ))}
        </div>
      </div>

      <BigOReference open={showBigO} onClose={() => setShowBigO(false)} />
    </div>
  );
}
