import { useState, useEffect } from 'react';
import AppLayout from './components/AppLayout.jsx';
import { getMe } from './api/client.js';

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('ownai-theme') || 'light');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('ownai-theme', theme);
  }, [theme]);

  useEffect(() => {
    getMe().catch(() => {});
  }, []);

  return (
    <AppLayout
      theme={theme}
      onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
    />
  );
}
