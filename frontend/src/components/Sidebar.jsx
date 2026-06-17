import { groupChatsByDate } from '../utils/chatStorage.js';

function ChatRow({ chat, active, onSelect, onDelete }) {
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => onSelect(chat.id)}
        className={`w-full truncate rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
          active
            ? 'bg-stone-200/80 text-slate-900 dark:bg-slate-700 dark:text-white'
            : 'text-slate-700 hover:bg-stone-100 dark:text-slate-300 dark:hover:bg-slate-800'
        }`}
        title={chat.title || 'New conversation'}
      >
        {chat.title || 'New conversation'}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(chat.id);
        }}
        className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-xs text-slate-400 opacity-0 transition-opacity hover:bg-rose-100 hover:text-rose-600 group-hover:opacity-100 dark:hover:bg-rose-950"
        aria-label="Delete chat"
      >
        ×
      </button>
    </div>
  );
}

export default function Sidebar({
  chats,
  activeChatId,
  onNewChat,
  onSelectChat,
  onDeleteChat,
  collapsed = false,
  onToggleCollapse,
  user,
}) {
  const grouped = groupChatsByDate(chats);
  const username = user?.email?.split('@')[0];

  if (collapsed) {
    return (
      <aside className="flex w-16 shrink-0 flex-col items-center border-r border-stone-200 bg-[#f2f1ed] py-3 dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="mb-3 rounded-lg p-2 text-slate-600 hover:bg-stone-200 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="Expand sidebar"
        >
          ☰
        </button>
        <button
          type="button"
          onClick={onNewChat}
          className="rounded-lg p-2 text-slate-600 hover:bg-stone-200 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="New chat"
          title="New chat"
        >
          ✏️
        </button>
      </aside>
    );
  }

  return (
    <aside className="flex w-[280px] shrink-0 flex-col border-r border-stone-200 bg-[#f2f1ed] dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold tracking-tight text-slate-800 dark:text-white">OWNAI</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onNewChat}
            className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-stone-200 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="New chat"
            title="New chat"
          >
            ✏️
          </button>
          <button
            type="button"
            onClick={onToggleCollapse}
            className="rounded-lg p-2 text-slate-600 hover:bg-stone-200 md:hidden dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Collapse sidebar"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={onNewChat}
          className="w-full rounded-xl bg-white px-3 py-2.5 text-left text-sm font-medium text-slate-700 shadow-sm ring-1 ring-stone-200 hover:bg-stone-50 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-700"
        >
          + New chat
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {Object.keys(grouped).length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-slate-500">No conversations yet</p>
        ) : (
          Object.entries(grouped).map(([group, groupChats]) => (
            <section key={group} className="mb-4">
              <p className="mb-2 px-2 text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {group}
              </p>
              <div className="space-y-0.5">
                {groupChats.map((chat) => (
                  <ChatRow
                    key={chat.id}
                    chat={chat}
                    active={chat.id === activeChatId}
                    onSelect={onSelectChat}
                    onDelete={onDeleteChat}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      {username && (
        <div className="border-t border-stone-200 px-3 py-3 text-xs text-slate-500 dark:border-slate-800">
          {username}
        </div>
      )}
    </aside>
  );
}
