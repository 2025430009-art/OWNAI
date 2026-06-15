import { useState } from 'react';
import { login, signup } from '../api/client.js';

export default function AuthForm({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
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

  return (
    <div className="card p-6 max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-1">
        {mode === 'login' ? 'Sign In' : 'Create Account'}
      </h2>
      <p className="text-sm text-slate-400 mb-6">
        {mode === 'login' ? 'Access usage tracking and saved sessions' : 'Register for the OWN AI platform'}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
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

        <button type="submit" disabled={loading} className="btn-primary w-full">
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
