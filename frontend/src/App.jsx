import { useState, useEffect } from 'react';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import ChatInterface from './components/ChatInterface.jsx';
import AuthForm from './components/AuthForm.jsx';
import AICapabilities from './components/AICapabilities.jsx';
import CapabilityDemo from './components/CapabilityDemo.jsx';
import ArchitectureOverview from './components/ArchitectureOverview.jsx';
import HomePage from './pages/HomePage.jsx';
import InstallPage from './pages/InstallPage.jsx';
import UserGuidePage from './pages/UserGuidePage.jsx';
import ApiPage from './pages/ApiPage.jsx';
import ExamplesPage from './pages/ExamplesPage.jsx';
import CommunityPage from './pages/CommunityPage.jsx';
import ReleaseHighlightsPage from './pages/ReleaseHighlightsPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ResearchPage from './pages/ResearchPage.jsx';
import { healthCheck, listModels, getMe, listCapabilities, logout, listResearchProjects } from './api/client.js';

export default function App() {
  const [user, setUser] = useState(null);
  const [apiStatus, setApiStatus] = useState('checking');
  const [models, setModels] = useState([]);
  const [capabilities, setCapabilities] = useState([]);
  const [researchCount, setResearchCount] = useState(0);
  const [activeCapability, setActiveCapability] = useState(null);
  const [tab, setTab] = useState('home');
  const [theme, setTheme] = useState(() => localStorage.getItem('ownai-theme') || 'light');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('ownai-theme', theme);
  }, [theme]);

  useEffect(() => {
    healthCheck()
      .then(() => setApiStatus('online'))
      .catch(() => setApiStatus('offline'));

    listModels()
      .then((data) => setModels(data.available || []))
      .catch(() => {});

    listCapabilities()
      .then((data) => setCapabilities(data.capabilities || []))
      .catch(() => {});

    getMe()
      .then((data) => {
        setUser(data.user);
        if (data.user) {
          listResearchProjects()
            .then((res) => {
              const active = (res.projects || []).filter((p) => p.status === 'active');
              setResearchCount(active.length);
            })
            .catch(() => setResearchCount(0));
        } else {
          setResearchCount(0);
        }
      })
      .catch(() => setUser(null));
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // Clear local UI state even if backend is unreachable
    }
    setUser(null);
  };

  const navigate = (page) => {
    setTab(page);
    window.scrollTo(0, 0);
  };

  const tryCapability = (cap) => {
    const full = capabilities.find((c) => c.slug === cap.slug) || cap;
    setActiveCapability(full);
  };

  const isDashboard = tab === 'dashboard';

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-slate-950">
      {!isDashboard && (
        <Header
          activeTab={tab}
          onNavigate={navigate}
          user={user}
          onLogout={handleLogout}
          apiStatus={apiStatus}
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          researchCount={researchCount}
        />
      )}

      <main className={isDashboard ? 'flex-1' : 'flex-1'}>
        {tab === 'home' && (
          <HomePage onNavigate={navigate} onTryCapability={tryCapability} />
        )}
        {tab === 'install' && <InstallPage />}
        {tab === 'guide' && <UserGuidePage onNavigate={navigate} />}
        {tab === 'api' && <ApiPage />}
        {tab === 'examples' && <ExamplesPage onTryCapability={tryCapability} />}
        {tab === 'highlights' && <ReleaseHighlightsPage onNavigate={navigate} />}
        {tab === 'community' && <CommunityPage />}
        {tab === 'capabilities' && (
          <div className="py-8">
            <AICapabilities
              capabilities={capabilities}
              onTry={tryCapability}
            />
          </div>
        )}
        {tab === 'architecture' && <ArchitectureOverview />}
        {tab === 'dashboard' && (
          <DashboardPage
            models={models}
            user={user}
            onSignIn={() => navigate('account')}
            onNavigate={navigate}
            theme={theme}
            onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          />
        )}
        {tab === 'playground' && <ChatInterface models={models} user={user} />}
        {tab === 'research' && (
          <ResearchPage
            user={user}
            onNavigate={navigate}
            onSignIn={() => navigate('account')}
          />
        )}
        {tab === 'account' && (
          <div className="mx-auto max-w-md px-4 py-12">
            {user ? (
              <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Account</h2>
                <p className="mt-2 text-sm text-slate-500">Signed in as {user.email}</p>
              </div>
            ) : (
              <AuthForm onAuth={(u) => { setUser(u); navigate('playground'); }} />
            )}
          </div>
        )}
      </main>

      {activeCapability && (
        <CapabilityDemo
          capability={activeCapability}
          onClose={() => setActiveCapability(null)}
        />
      )}

      {!isDashboard && <Footer onNavigate={navigate} />}
    </div>
  );
}
