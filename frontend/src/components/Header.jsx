const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'install', label: 'Install' },
  { id: 'guide', label: 'User Guide' },
  { id: 'api', label: 'API' },
  { id: 'examples', label: 'Examples' },
  { id: 'playground', label: 'Playground' },
  { id: 'community', label: 'Community' },
];

export default function Header({ activeTab, onNavigate, user, onLogout, apiStatus, theme, onToggleTheme }) {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2.5 text-left"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-teal-600 text-sm font-bold text-white">
            AI
          </div>
          <div>
            <span className="text-lg font-bold text-slate-900 dark:text-white">OWNAI</span>
            <p className="text-[10px] leading-tight text-slate-500">AI on your hardware</p>
          </div>
        </button>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === item.id
                  ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <span
            className={`hidden text-xs sm:inline ${
              apiStatus === 'online' ? 'text-green-600' : 'text-red-500'
            }`}
          >
            {apiStatus === 'online' ? '● API' : '○ API'}
          </span>
          <button
            type="button"
            onClick={onToggleTheme}
            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          {user ? (
            <button
              type="button"
              onClick={onLogout}
              className="hidden text-sm text-slate-500 hover:text-slate-700 sm:block dark:hover:text-slate-300"
            >
              Logout
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate('account')}
              className="rounded-md bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700"
            >
              Sign in
            </button>
          )}
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2 md:hidden dark:border-slate-800">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium ${
              activeTab === item.id
                ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </header>
  );
}

export { NAV_ITEMS };
