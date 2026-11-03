import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../lib/api.js';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';

export function ForgotPasswordView() {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await apiFetch('/auth/forgot-password', {
        method: 'POST',
        skipAuth: true,
        body: JSON.stringify({ email }),
      });
      setIsSubmitted(true);
    } catch {
      // Always treat as submitted to prevent email enumeration
      setIsSubmitted(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-text">Reset Password</h1>
          <p className="mt-2 text-sm text-text-muted">
            Enter your email to receive instructions to reset your account password.
          </p>
        </div>

        <div className="bg-surface py-8 px-6 shadow-card border border-border sm:rounded-2xl sm:px-10">
          {!isSubmitted ? (
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                  Email Address
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-muted">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 bg-surface-2 border border-border rounded-xl text-text placeholder-text-muted/60 text-sm focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                    placeholder="name@agency.com"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center py-2.5 px-4 rounded-xl shadow-md text-sm font-semibold text-white bg-accent hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {isLoading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          ) : (
            <div className="text-center py-4 space-y-3">
              <CheckCircle2 className="w-12 h-12 text-success mx-auto" />
              <h3 className="text-base font-bold text-text">Check your inbox</h3>
              <p className="text-xs text-text-muted">
                If an account exists for <span className="font-semibold text-text">{email}</span>, we have sent a secure password reset link.
              </p>
            </div>
          )}

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="inline-flex items-center text-xs font-semibold text-accent hover:underline"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
