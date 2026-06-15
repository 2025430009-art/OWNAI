import { useState, useEffect } from 'react';
import { login, signup } from '../api/client.js';
import BackendConnectPanel from './dashboard/BackendConnectPanel.jsx';
import {
  canReachBackend,
  hasBackendConfigured,
  SIGNIN_REQUIRES_BACKEND_MSG,
  getApiStatusMessage,
} from '../utils/apiConfig.js';

export default function AuthForm({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [backendOnline, setBackendOnline] = useState(null);

  useEffect(() => {
    if (!hasBackendConfigured()) {
      setBackendOnline(false);
      return;
    }
    canReachBackend().then(setBackendOnline);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hasBackendConfigured()) {
      setError(SIGNIN_REQUIRES_BACKEND_MSG);
      return;
    }
    setError('');
    setLoading(true);

    try {
      const fn = mode === 'login' ? login : signup;
      const data = await fn(email, password);
      localStorage.setItem('ownai_token', data.token);
      onAuth(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const statusMessage = getApiStatusMessage();

  return (
    <div className="card p-6 max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-1">
        {mode === 'login' ? 'Sign In' : 'Create Account'}
      </h2>
      <p className="text-sm text-slate-400 mb-4">
        {mode === 'login' ? 'Access usage tracking and saved sessions' : 'Register for the OWN AI platform'}
      </p>

      {statusMessage && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          {statusMessage}
        </div>
      )}

      {backendOnline === false && hasBackendConfigured() && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          Backend not connected. Please run the backend server locally:{' '}
          <code className="text-xs">cd backend && npm run start</code>
        </div>
      )}

      <BackendConnectPanel compact onConnected={() => canReachBackend().then(setBackendOnline)} />

      <form onSubmit={handleSubmit} className="space-y-4 mt-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-field"
            required
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-field"
            minLength={8}
            required
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading || !hasBackendConfigured()}
          className="btn-primary w-full disabled:opacity-50"
          title={!hasBackendConfigured() ? SIGNIN_REQUIRES_BACKEND_MSG : undefined}
        >
          {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Sign Up'}
        </button>
      </form>

      <p className="text-sm text-slate-400 mt-4 text-center">
        {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
        <button
          type="button"
          onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
          className="text-primary-400 hover:text-primary-300"
        >
          {mode === 'login' ? 'Sign up' : 'Sign in'}
        </button>
      </p>
    </div>
  );
}
