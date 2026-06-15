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
import { healthCheck, listModels, getMe, listCapabilities } from './api/client.js';

export default function App() {
  const [user, setUser] = useState(null);
  const [apiStatus, setApiStatus] = useState('checking');
  const [models, setModels] = useState([]);
  const [capabilities, setCapabilities] = useState([]);
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

    const token = localStorage.getItem('ownai_token');
    if (token) {
      getMe()
        .then((data) => setUser(data.user))
        .catch(() => localStorage.removeItem('ownai_token'));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('ownai_token');
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

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-slate-950">
      <Header
        activeTab={tab}
        onNavigate={navigate}
        user={user}
        onLogout={handleLogout}
        apiStatus={apiStatus}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      />

      <main className="flex-1">
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
        {tab === 'playground' && <ChatInterface models={models} />}
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

      <Footer onNavigate={navigate} />
    </div>
  );
}
