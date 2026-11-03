import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore.js';
import { apiFetch } from '../../lib/api.js';
import { NetworkIcon } from '../common/NetworkIcon.js';

const DEMO_ACCOUNTS = [
  { name: 'Devon Miles', role: 'Owner', email: 'owner@example.com', badge: 'rbadge--ink', tone: 'av--t0' },
  { name: 'Sophia Chen', role: 'Admin', email: 'admin@example.com', badge: 'rbadge--sea', tone: 'av--t1' },
  { name: 'Marcus Vance', role: 'Manager', email: 'manager@example.com', badge: 'rbadge--pine', tone: 'av--t2' },
  { name: 'Liam Gallagher', role: 'Editor', email: 'editor@example.com', badge: 'rbadge--butter', tone: 'av--t3' },
  { name: 'Chloe Dubois', role: 'Community', email: 'community@example.com', badge: 'rbadge--lilac', tone: 'av--t0' },
  { name: 'Aria Patel', role: 'Analyst', email: 'analyst@example.com', badge: 'rbadge--plain', tone: 'av--t1' },
  { name: 'Ethan Hunt', role: 'Client', email: 'client@example.com', badge: 'rbadge--coral', tone: 'av--t2' },
];

export function LoginView() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);

  const [email, setEmail] = useState('owner@example.com');
  const [password, setPassword] = useState('Password123!@#');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 2FA challenge state
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (challengeId) {
        const data = await apiFetch('/auth/2fa/verify', {
          method: 'POST',
          skipAuth: true,
          body: JSON.stringify({ challengeId, code: totpCode }),
        });
        await setSession(data);
        navigate('/overview');
      } else {
        const data = await apiFetch('/auth/login', {
          method: 'POST',
          skipAuth: true,
          body: JSON.stringify({ email, password }),
        });

        if (data.needs2fa) {
          setChallengeId(data.challengeId);
        } else {
          await setSession(data);
          navigate('/overview');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePickDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('Password123!@#');
    setChallengeId(null);
    setError(null);
  };

  return (
    <div className="signin">
      <div className="signin__panel">
        {/* Left column: Intro banner */}
        <div className="signin__intro">
          <div className="brand" aria-label="Murmura">
            <span className="brand__mark" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M4 15.5c2.2-3.6 4.4-3.6 6.6 0s4.4 3.6 6.6 0" />
                <path d="M6.5 10c1.6-2.4 3.2-2.4 4.8 0s3.2 2.4 4.8 0" />
                <circle cx="19.2" cy="8.2" r="1.3" />
              </svg>
            </span>
            <span className="brand__name">murmura</span>
          </div>

          <h2 className="signin__lede">
            Every social account, <em>one calm workspace.</em>
          </h2>

          <div className="signin__nets">
            {['INSTAGRAM', 'FACEBOOK', 'X', 'LINKEDIN', 'TIKTOK', 'YOUTUBE', 'PINTEREST', 'THREADS'].map(
              (net) => (
                <span key={net} className={`net net--sm net--${net.toLowerCase()}`}>
                  <NetworkIcon network={net} className="ico" />
                </span>
              )
            )}
          </div>

          <div className="signin__foot">
            <span>VS Adda Agency &middot; PostDesk Platform</span>
          </div>
        </div>

        {/* Right column: Sign in form */}
        <div className="signin__form">
          <h1>Sign in</h1>
          <p>Enter your details or pick an agency demo account below.</p>

          {error && <div className="signin__err">{error}</div>}

          {!challengeId ? (
            <form onSubmit={handleSubmit} className="signin__fields">
              <div className="field">
                <label className="field__label">Email address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  placeholder="name@agency.com"
                />
              </div>

              <div className="field">
                <label className="field__label">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                className="btn btn--ink"
                style={{ width: '100%', marginTop: '6px' }}
                disabled={isLoading}
              >
                {isLoading ? 'Signing in...' : 'Sign in to workspace'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="signin__fields">
              <div className="field">
                <label className="field__label">Two-Factor Authentication Code</label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  autoFocus
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  className="input text-center tracking-widest text-lg font-mono"
                  placeholder="123456"
                />
              </div>
              <button
                type="submit"
                className="btn btn--ink"
                style={{ width: '100%', marginTop: '6px' }}
                disabled={isLoading || totpCode.length !== 6}
              >
                {isLoading ? 'Verifying...' : 'Verify & Continue'}
              </button>
            </form>
          )}

          <div className="signin__or">or pick a demo role</div>

          <div className="signin__people">
            {DEMO_ACCOUNTS.map((person) => {
              const isSelected = email === person.email;
              const initials = person.name
                .split(' ')
                .map((n) => n[0])
                .join('');

              return (
                <button
                  key={person.email}
                  type="button"
                  onClick={() => handlePickDemo(person.email)}
                  className={`signin__person ${isSelected ? 'tone--plain' : ''}`}
                  style={isSelected ? { outline: '2px solid var(--text)' } : undefined}
                >
                  <span className={`av av--sm ${person.tone}`}>{initials}</span>
                  <div>
                    <b>{person.name}</b>
                    <small>
                      <span className={`rbadge ${person.badge}`}>{person.role}</span>
                    </small>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
