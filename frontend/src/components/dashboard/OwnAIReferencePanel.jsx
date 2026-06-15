import { useState, useEffect, useCallback, useRef } from 'react';
import { LogoMark } from './DashboardIcons.jsx';
import ReferenceMarkdown from './ReferenceMarkdown.jsx';
import { parseOwnAIExport } from '../../utils/ownaiqaParser.js';
import {
  listOwnAIQa,
  saveOwnAIQa,
  deleteOwnAIQa,
  searchOwnAIQa,
} from '../../api/client.js';

function QaPair({ entry, onDelete, isNew }) {
  const [hover, setHover] = useState(false);

  return (
    <article
      className={`group relative transition-opacity duration-500 ${isNew ? 'animate-fade-in opacity-100' : 'opacity-100'}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {hover && (
        <button
          type="button"
          onClick={() => onDelete(entry.id)}
          className="absolute right-0 top-0 rounded-md p-1.5 text-slate-400 opacity-0 transition-opacity hover:bg-stone-100 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-slate-800"
          aria-label="Delete entry"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
            <path d="M5 6h10M8 6V4h4v2M7 6v9a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      <div className="flex justify-end">
        <div
          className="max-w-[85%] rounded-[18px_18px_4px_18px] bg-[#F0F0F0] px-4 py-3 text-[15px] font-normal leading-relaxed text-[#1A1A1A] dark:bg-slate-800 dark:text-slate-100"
          style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
        >
          {entry.question}
        </div>
      </div>

      <div className="mt-4 flex gap-3">
        <LogoMark className="mt-0.5 h-6 w-6 shrink-0" />
        <div className="min-w-0 flex-1 py-2">
          <ReferenceMarkdown content={entry.answer} />
          {(entry.topic || entry.createdAt) && (
            <p className="mt-3 text-xs text-slate-400">
              {entry.topic && <span className="mr-2 rounded-full bg-stone-100 px-2 py-0.5 dark:bg-slate-800">{entry.topic}</span>}
              {entry.createdAt && new Date(entry.createdAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      <hr className="mt-8 border-[#EEEEEE] dark:border-slate-800" />
    </article>
  );
}

export default function OwnAIReferencePanel({ onSaveFromChat }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [topicFilter, setTopicFilter] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [topic, setTopic] = useState('');
  const [pasteRaw, setPasteRaw] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const [newEntryId, setNewEntryId] = useState(null);
  const listEndRef = useRef(null);

  const loadEntries = useCallback(async (q, topic) => {
    setLoading(true);
    setError('');
    try {
      const data = q
        ? await searchOwnAIQa(q)
        : await listOwnAIQa(topic ? { topic } : {});
      setEntries(data.entries || []);
    } catch (err) {
      setError(err.message);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadEntries(searchQuery.trim(), topicFilter.trim());
    }, searchQuery ? 300 : 0);
    return () => clearTimeout(timer);
  }, [searchQuery, topicFilter, loadEntries]);

  useEffect(() => {
    if (onSaveFromChat) {
      onSaveFromChat.current = async (q, a, t = 'Chat') => {
        try {
          const { entry } = await saveOwnAIQa({ question: q, answer: a, topic: t });
          setEntries((prev) => [entry, ...prev.filter((e) => e.id !== entry.id)]);
          setNewEntryId(entry.id);
          setTimeout(() => setNewEntryId(null), 2000);
        } catch {
          // silent — reference save is best-effort from chat
        }
      };
    }
  }, [onSaveFromChat]);

  const topics = [...new Set(entries.map((e) => e.topic).filter(Boolean))].sort();

  const handleSave = async () => {
    if (!question.trim() || !answer.trim()) {
      setError('Question and answer are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { entry } = await saveOwnAIQa({
        question: question.trim(),
        answer: answer.trim(),
        topic: topic.trim(),
      });
      setEntries((prev) => [entry, ...prev]);
      setQuestion('');
      setAnswer('');
      setTopic('');
      setNewEntryId(entry.id);
      setTimeout(() => {
        listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        setNewEntryId(null);
      }, 100);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePasteParse = () => {
    const parsed = parseOwnAIExport(pasteRaw);
    if (parsed.question) setQuestion(parsed.question);
    if (parsed.answer) setAnswer(parsed.answer);
    setPasteRaw('');
    setShowPaste(false);
  };

  const handleDelete = async (id) => {
    try {
      await deleteOwnAIQa(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#FAFAFA] dark:bg-slate-950">
      <div className="shrink-0 border-b border-stone-200 bg-[#FAFAFA]/95 px-4 py-6 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:px-8">
        <div className="mx-auto max-w-[720px]">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">OWN AI Reference</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Saved questions and answers from your OWNAI conversations
          </p>

          <div className="mt-6 space-y-3 rounded-xl border border-stone-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Question"
              className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-[15px] text-slate-800 focus:border-teal-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Answer (markdown supported)"
              rows={5}
              className="w-full resize-y rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-[15px] text-slate-800 focus:border-teal-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Topic (optional)"
                className="min-w-[140px] flex-1 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => setShowPaste((s) => !s)}
                className="rounded-lg border border-stone-200 px-3 py-2 text-sm text-slate-600 hover:bg-stone-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Paste conversation
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-teal-600 px-5 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
            {showPaste && (
              <div className="space-y-2 border-t border-stone-100 pt-3 dark:border-slate-800">
                <textarea
                  value={pasteRaw}
                  onChange={(e) => setPasteRaw(e.target.value)}
                  placeholder="Paste raw conversation — User:/OWN AI: labels auto-detected"
                  rows={4}
                  className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={handlePasteParse}
                  className="text-sm text-teal-600 hover:text-teal-700"
                >
                  Parse into question & answer
                </button>
              </div>
            )}
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search questions and answers…"
              className="min-w-[200px] flex-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <select
              value={topicFilter}
              onChange={(e) => setTopicFilter(e.target.value)}
              className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="">All topics</option>
              {topics.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-[720px] space-y-8">
          {loading && <p className="text-center text-sm text-slate-400">Loading reference…</p>}
          {!loading && entries.length === 0 && (
            <p className="text-center text-sm text-slate-400">
              No saved Q&A yet. Save from chat or use the form above.
            </p>
          )}
          {entries.map((entry) => (
            <QaPair
              key={entry.id}
              entry={entry}
              onDelete={handleDelete}
              isNew={entry.id === newEntryId}
            />
          ))}
          <div ref={listEndRef} />
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.4s ease-out; }
      `}</style>
    </div>
  );
}
