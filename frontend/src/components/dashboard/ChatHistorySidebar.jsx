import { useMemo, useState } from 'react';
import { PlusIcon, SearchIcon } from './DashboardIcons.jsx';
import {
  formatSessionTime,
  getFirstMessagePreview,
  groupSessionsByDate,
  searchSessions,
} from '../../utils/chatStorage.js';

function DeleteButton({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="rounded p-1 text-slate-400 opacity-0 transition-opacity hover:bg-rose-500/10 hover:text-rose-500 group-hover:opacity-100"
      aria-label={`Delete ${label}`}
      title="Delete chat"
    >
      ×
    </button>
  );
}

function SessionRow({ session, active, onSelect, onDelete }) {
  const preview = getFirstMessagePreview(session);
  const time = formatSessionTime(session.updatedAt);

  return (
    <li className="group relative">
      <button
        type="button"
        onClick={() => onSelect(session.id)}
        className={`flex w-full flex-col gap-0.5 rounded-lg px-3 py-2.5 pr-8 text-left transition-colors ${
          active
            ? 'bg-teal-50 ring-1 ring-teal-200/80 dark:bg-teal-950/40 dark:ring-teal-800/60'
            : 'hover:bg-stone-100 dark:hover:bg-slate-800'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className={`truncate text-sm font-medium ${active ? 'text-teal-900 dark:text-teal-100' : 'text-slate-800 dark:text-slate-100'}`}>
            {session.title}
          </span>
          <span className="shrink-0 text-[10px] text-slate-400">{time}</span>
        </div>
        <p className="line-clamp-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
          {preview}
        </p>
      </button>
      <div className="absolute right-2 top-2">
        <DeleteButton label={session.title} onClick={() => onDelete(session.id)} />
      </div>
    </li>
  );
}

export default function ChatHistorySidebar({
  sessions,
  activeSessionId,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  collapsed = false,
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(
    () => searchSessions(sessions, query),
    [sessions, query],
  );

  const groups = useMemo(
    () => groupSessionsByDate(filtered),
    [filtered],
  );

  if (collapsed) {
    return (
      <div className="px-2 pb-2">
        <button
          type="button"
          onClick={onNewChat}
          className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-stone-200/80 text-slate-600 hover:bg-stone-300 dark:bg-slate-700 dark:text-slate-200"
          aria-label="New chat"
          title="New chat"
        >
          <PlusIcon />
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col px-2">
      <div className="mb-2 space-y-2">
        <button
          type="button"
          onClick={onNewChat}
          className="flex w-full items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-stone-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-750"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-teal-600 text-white">
            <PlusIcon />
          </span>
          New chat
        </button>

        <div className="relative">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
            <SearchIcon />
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats…"
            className="w-full rounded-lg border border-stone-200 bg-white py-2 pl-8 pr-3 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-teal-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {groups.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-slate-400">
            {query ? 'No chats match your search' : 'No conversations yet'}
          </p>
        ) : (
          groups.map((group) => (
            <section key={group.bucket} className="mb-4">
              <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.sessions.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    active={activeSessionId === session.id}
                    onSelect={onSelectSession}
                    onDelete={onDeleteSession}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
