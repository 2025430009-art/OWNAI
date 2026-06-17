import {
  LogoMark,
  ChatIcon,
  FolderIcon,
  ShapesIcon,
  SlidersIcon,
  CodeIcon,
  PaletteIcon,
  BookIcon,
  LibraryIcon,
  SearchIcon,
  PanelIcon,
  BeakerIcon,
  VideoIcon,
} from './DashboardIcons.jsx';
import { MemoryIndicator } from './MemoryPanel.jsx';
import { ThinkingHistorySidebar } from './ThinkingHistoryPanel.jsx';
import BackendConnectPanel from './BackendConnectPanel.jsx';
import ChatHistorySidebar from './ChatHistorySidebar.jsx';

const NAV_MAIN = [
  { id: 'chats', label: 'Chats', icon: ChatIcon },
  { id: 'research', label: 'Research', icon: BeakerIcon },
  { id: 'reference', label: 'OWN AI Reference', icon: BookIcon },
  { id: 'code-library', label: 'Code Library', icon: LibraryIcon },
  { id: 'projects', label: 'Projects', icon: FolderIcon },
  { id: 'artifacts', label: 'Artifacts', icon: ShapesIcon },
  { id: 'customize', label: 'Customize', icon: SlidersIcon },
];

const NAV_PRODUCTS = [
  { id: 'code', label: 'Code', icon: CodeIcon },
  { id: 'design', label: 'Design', icon: PaletteIcon },
  { id: 'human-think', label: 'Human Think', icon: BeakerIcon },
  { id: 'prompt-to-video', label: 'PromptToVideo', icon: VideoIcon },
];

function NavButton({ item, active, onClick, badge }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={() => onClick(item.id)}
      className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
        active
          ? 'bg-teal-50 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200'
          : 'text-slate-600 hover:bg-stone-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
      }`}
    >
      <Icon />
      <span className="truncate">{item.label}</span>
      {badge > 0 && (
        <span className="ml-auto rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
          {badge}
        </span>
      )}
    </button>
  );
}

export default function DashboardSidebar({
  activeSection,
  onSectionChange,
  onNewChat,
  sessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
  user,
  onSignIn,
  collapsed,
  onToggleCollapse,
  theme,
  onToggleTheme,
  researchCount = 0,
  memoryCount,
  onOpenMemory,
  thinkingLogs = [],
  onOpenThinkingHistory,
  taskMode,
  activeModel,
  memoryFacts,
  onClearMemory,
  backendNotice,
  onBackendConnected,
}) {
  const displayName = user?.email?.split('@')[0] || 'Guest';
  const planLabel = user ? 'Signed in' : 'Public access';

  return (
    <aside
      className={`flex h-full flex-col border-r border-stone-200 bg-stone-50/80 transition-all dark:border-slate-800 dark:bg-slate-900/60 ${
        collapsed ? 'w-[4.5rem]' : 'w-72'
      }`}
    >
      <div className="flex items-center justify-between gap-2 p-3">
        <button
          type="button"
          onClick={onNewChat}
          className={`flex items-center gap-2 ${collapsed ? 'mx-auto' : ''}`}
          aria-label="OWNAI home"
        >
          <LogoMark className="h-7 w-7 shrink-0" />
          {!collapsed && (
            <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
              OWNAI
            </span>
          )}
        </button>
        {!collapsed && (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              className="rounded-md p-1.5 text-slate-400 hover:bg-stone-200/80 hover:text-slate-600 dark:hover:bg-slate-800"
              aria-label="Search"
            >
              <SearchIcon />
            </button>
            <button
              type="button"
              onClick={onToggleCollapse}
              className="rounded-md p-1.5 text-slate-400 hover:bg-stone-200/80 hover:text-slate-600 dark:hover:bg-slate-800"
              aria-label="Collapse sidebar"
            >
              <PanelIcon />
            </button>
          </div>
        )}
      </div>

      {!collapsed ? (
        <div className="flex min-h-0 flex-1 flex-col border-b border-stone-200 dark:border-slate-800">
          <ChatHistorySidebar
            sessions={sessions}
            activeSessionId={activeSessionId}
            onNewChat={onNewChat}
            onSelectSession={(id) => {
              onSelectSession(id);
              onSectionChange('chat');
            }}
            onDeleteSession={onDeleteSession}
          />
        </div>
      ) : (
        <ChatHistorySidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onNewChat={onNewChat}
          onSelectSession={onSelectSession}
          onDeleteSession={onDeleteSession}
          collapsed
        />
      )}

      {!collapsed && (
        <BackendConnectPanel
          variant="sidebar"
          taskMode={taskMode}
          activeModel={activeModel}
          memoryFacts={memoryFacts}
          onClearMemory={onClearMemory}
          notice={backendNotice}
          onConnected={onBackendConnected}
        />
      )}

      <nav className="flex flex-col gap-0.5 px-2">
        {NAV_MAIN.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            active={activeSection === item.id}
            onClick={onSectionChange}
            badge={item.id === 'research' ? researchCount : 0}
          />
        ))}
      </nav>

      {!collapsed && (
        <div className="mt-4 px-2">
          <div className="mb-2 flex items-center justify-between px-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Memory
            </p>
            {user && (
              <MemoryIndicator count={memoryCount} onClick={onOpenMemory} user={user} />
            )}
          </div>
          {user && memoryCount === 0 && (
            <p className="px-3 py-1 text-xs text-slate-400">No memories yet</p>
          )}
        </div>
      )}

      {!collapsed && thinkingLogs.length > 0 && (
        <ThinkingHistorySidebar
          logs={thinkingLogs}
          onOpenPanel={onOpenThinkingHistory}
        />
      )}

      {!collapsed && (
        <div className="mt-5 px-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Products
          </p>
          <div className="flex flex-col gap-0.5">
            {NAV_PRODUCTS.map((item) => (
              <NavButton
                key={item.id}
                item={item}
                active={activeSection === item.id}
                onClick={onSectionChange}
              />
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto border-t border-stone-200 p-2 dark:border-slate-800">
        <button
          type="button"
          onClick={user ? undefined : onSignIn}
          className={`flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-stone-100 dark:hover:bg-slate-800 ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-600 text-sm font-bold text-white">
            {displayName.charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800 dark:text-white">
                {displayName}
              </p>
              <p className="truncate text-xs text-slate-400">{planLabel}</p>
            </div>
          )}
          {!collapsed && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleTheme();
              }}
              className="rounded-md p-1.5 text-slate-400 hover:bg-stone-200 dark:hover:bg-slate-700"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          )}
        </button>
      </div>

      {collapsed && (
        <button
          type="button"
          onClick={onToggleCollapse}
          className="border-t border-stone-200 p-3 text-slate-400 hover:text-slate-600 dark:border-slate-800"
          aria-label="Expand sidebar"
        >
          <PanelIcon />
        </button>
      )}
    </aside>
  );
}
