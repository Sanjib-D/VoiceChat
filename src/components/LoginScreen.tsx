import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';

export function LoginScreen() {
  const { 
    setIsAuthenticated,
    username, setUsername, 
    setUserId, setFriends,
    error, setError
  } = useAppStore();
  
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Username and password are required');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    try {
      const endpoint = authMode === 'login' ? '/api/login' : '/api/signup';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      
      if (data.success) {
        setUsername(data.username);
        if (data.userId) setUserId(data.userId);
        if (data.friends) setFriends(data.friends);
        setIsAuthenticated(true);
      } else {
        setError(data.message || 'Authentication failed');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1E1F22] flex items-center justify-center p-4 text-[#DBDEE1] font-sans select-none">
      <div className="w-[400px] bg-[#2B2D31] p-8 rounded-lg shadow-2xl border border-[#1E1F22]">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">OmniChat Pro</h1>
          <p className="text-[#949BA4] text-sm">
            {authMode === 'login' ? "Welcome back! Please log in." : "Create a new account."}
          </p>
        </div>

        {error && (
          <div className="bg-[#F23F42] bg-opacity-20 text-[#FA777C] p-3 rounded mb-4 text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-2 tracking-wide">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-[#1E1F22] text-[#DBDEE1] px-3 py-2.5 rounded focus:outline-none focus:ring-2 focus:ring-[#5865F2]"
              placeholder="Enter username"
              required
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-2 tracking-wide">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#1E1F22] text-[#DBDEE1] px-3 py-2.5 rounded focus:outline-none focus:ring-2 focus:ring-[#5865F2]"
              placeholder="Enter password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white font-semibold py-3 rounded transition-colors disabled:opacity-50 mt-6"
          >
            {authMode === 'login' ? 'Log In' : 'Sign Up'}
          </button>
          
          <div className="mt-4 text-xs text-[#949BA4]">
            {authMode === 'login' ? (
              <>Need an account? <span className="text-[#00A8FC] cursor-pointer hover:underline" onClick={() => setAuthMode('signup')}>Register</span></>
            ) : (
              <>Already have an account? <span className="text-[#00A8FC] cursor-pointer hover:underline" onClick={() => setAuthMode('login')}>Log In</span></>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
