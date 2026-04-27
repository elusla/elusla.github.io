'use client';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { MessageCircle } from 'lucide-react';

export default function AuthPage() {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '', email: '', password: '', displayName: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await login(formData.username || formData.email, formData.password);
      } else {
        await register(formData.username, formData.email, formData.password, formData.displayName);
      }
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="h-screen flex items-center justify-center bg-tg-bg">
      <div className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-tg-accent rounded-full mb-4">
            <MessageCircle className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-tg-text">Telegram Clone</h1>
          <p className="text-tg-muted mt-2">
            {isLogin ? 'Sign in to your account' : 'Create a new account'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <input
              type="text"
              placeholder="Display Name"
              value={formData.displayName}
              onChange={e => setFormData({ ...formData, displayName: e.target.value })}
              className="w-full px-4 py-3 bg-tg-input border border-tg-border rounded-xl text-tg-text placeholder-tg-muted focus:outline-none focus:border-tg-accent transition"
            />
          )}
          <input
            type="text"
            placeholder={isLogin ? 'Username or Email' : 'Username (e.g. @johndoe)'}
            value={formData.username}
            onChange={e => setFormData({ ...formData, username: e.target.value })}
            className="w-full px-4 py-3 bg-tg-input border border-tg-border rounded-xl text-tg-text placeholder-tg-muted focus:outline-none focus:border-tg-accent transition"
            required
          />
          {!isLogin && (
            <input
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-3 bg-tg-input border border-tg-border rounded-xl text-tg-text placeholder-tg-muted focus:outline-none focus:border-tg-accent transition"
              required
            />
          )}
          <input
            type="password"
            placeholder="Password"
            value={formData.password}
            onChange={e => setFormData({ ...formData, password: e.target.value })}
            className="w-full px-4 py-3 bg-tg-input border border-tg-border rounded-xl text-tg-text placeholder-tg-muted focus:outline-none focus:border-tg-accent transition"
            required
          />

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-tg-accent text-white rounded-xl font-semibold hover:bg-blue-400 transition disabled:opacity-50"
          >
            {loading ? 'Loading...' : isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <p className="text-center text-tg-muted mt-6">
          {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="text-tg-accent hover:underline"
          >
            {isLogin ? 'Sign Up' : 'Sign In'}
          </button>
        </p>
      </div>
    </div>
  );
}
