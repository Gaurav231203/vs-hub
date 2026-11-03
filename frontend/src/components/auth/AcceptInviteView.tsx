import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api.js';
import { useAuthStore } from '../../stores/authStore.js';
import { ShieldCheck, UserCheck, AlertCircle, ArrowRight, Check } from 'lucide-react';

export function AcceptInviteView() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);

  const [preview, setPreview] = useState<{ email: string; role: string; workspaceName: string } | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPreview() {
      try {
        const data = await apiFetch(`/auth/invite/${token}`, { skipAuth: true });
        setPreview(data);
      } catch (err: any) {
        setError(err.message || 'Invalid or expired invitation link');
      } finally {
        setIsLoading(false);
      }
    }
    if (token) loadPreview();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const data = await apiFetch(`/auth/invite/${token}/accept`, {
        method: 'POST',
        skipAuth: true,
        body: JSON.stringify({ name, password }),
      });
      await setSession(data);
      navigate('/overview');
    } catch (err: any) {
      setError(err.message || 'Failed to accept invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Password rules check
  const checks = {
    length: password.length >= 12,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
  const isPasswordValid = Object.values(checks).every(Boolean);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-6">
        <div className="w-8 h-8 border-3 border-accent/20 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent text-white shadow-lg shadow-accent/25 mb-4">
            <UserCheck className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-text">Join {preview?.workspaceName}</h1>
          <p className="mt-2 text-sm text-text-muted">
            You've been invited as a <span className="font-semibold text-text">{preview?.role}</span>
          </p>
        </div>

        <div className="bg-surface py-8 px-6 shadow-card border border-border sm:rounded-2xl sm:px-10">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-danger-bg/50 border border-danger/20 flex items-start space-x-3 text-sm text-danger">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                Your Email
              </label>
              <input
                type="email"
                disabled
                value={preview?.email || ''}
                className="block w-full px-3 py-2.5 bg-surface-2 border border-border rounded-xl text-text-muted text-sm cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="block w-full px-3 py-2.5 bg-surface-2 border border-border rounded-xl text-text text-sm focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                placeholder="Jane Doe"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                Create Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full px-3 py-2.5 bg-surface-2 border border-border rounded-xl text-text text-sm focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                placeholder="Minimum 12 characters"
              />

              {/* Password Requirements Checklist */}
              <div className="mt-3 grid grid-cols-2 gap-1.5 text-[11px] text-text-muted">
                <span className={`flex items-center space-x-1.5 ${checks.length ? 'text-success' : ''}`}>
                  <Check className="w-3.5 h-3.5" /> <span>Min 12 chars</span>
                </span>
                <span className={`flex items-center space-x-1.5 ${checks.upper ? 'text-success' : ''}`}>
                  <Check className="w-3.5 h-3.5" /> <span>Uppercase letter</span>
                </span>
                <span className={`flex items-center space-x-1.5 ${checks.lower ? 'text-success' : ''}`}>
                  <Check className="w-3.5 h-3.5" /> <span>Lowercase letter</span>
                </span>
                <span className={`flex items-center space-x-1.5 ${checks.number ? 'text-success' : ''}`}>
                  <Check className="w-3.5 h-3.5" /> <span>Number</span>
                </span>
                <span className={`flex items-center space-x-1.5 ${checks.special ? 'text-success' : ''}`}>
                  <Check className="w-3.5 h-3.5" /> <span>Special char</span>
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !isPasswordValid || !name}
              className="w-full flex items-center justify-center py-2.5 px-4 rounded-xl shadow-md text-sm font-semibold text-white bg-accent hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 mt-6"
            >
              {isSubmitting ? 'Activating account...' : 'Complete Invitation & Enter Workspace'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
