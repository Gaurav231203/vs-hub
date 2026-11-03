import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api.js';
import { useAuthStore } from '../../stores/authStore.js';
import { useToastStore } from '../../stores/toastStore.js';

export function SettingsView() {
  const queryClient = useQueryClient();
  const { user, workspace, role, brands, setSession } = useAuthStore();
  const addToast = useToastStore((state) => state.addToast);

  const [activeTab, setActiveTab] = useState<
    'profile' | 'notifications' | 'workspace' | 'approvals' | 'security' | 'billing' | 'appearance' | 'data'
  >(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      const match = hash.match(/#\/settings\/([a-z]+)/);
      if (match && ['profile', 'notifications', 'workspace', 'approvals', 'security', 'billing', 'appearance', 'data'].includes(match[1])) {
        return match[1] as any;
      }
    }
    return 'notifications';
  });

  React.useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      const match = hash.match(/#\/settings\/([a-z]+)/);
      if (match && ['profile', 'notifications', 'workspace', 'approvals', 'security', 'billing', 'appearance', 'data'].includes(match[1])) {
        setActiveTab(match[1] as any);
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const handleTabChange = (tabId: typeof activeTab) => {
    setActiveTab(tabId);
    window.location.hash = `#/settings/${tabId}`;
  };

  const handleDownloadInvoice = (inv: { id: string; month: string; total: string; amount: number }) => {
    const text = [
      'MURMURA — INVOICE',
      '',
      `Invoice ${inv.id}`,
      `Date: ${inv.month.replace(' ', ' 1, ')}`,
      `Billed to: ${profileName ? 'Northlight Studio' : 'Workspace'}`,
      '',
      `Agency plan ........................ $249.00`,
      `Extra seats ......................... $${inv.amount - 249}.00`,
      '',
      `Total paid .......................... ${inv.total}`,
      'Paid with Visa ending 4242. Thank you.',
    ].join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `murmura-invoice-${inv.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToast({ type: 'success', message: `Downloaded invoice ${inv.id}` });
  };

  // Form states
  const [profileName, setProfileName] = useState(user?.name || 'Camila Ortiz');
  const [profileTitle, setProfileTitle] = useState(user?.title || 'Founder');
  const [profileEmail, setProfileEmail] = useState(user?.email || 'camila@northlight.studio');
  const [avatarMode, setAvatarMode] = useState<'photo' | 'initials'>('photo');

  // Notifications state (Screenshot 1)
  const [notifApprovals, setNotifApprovals] = useState(true);
  const [notifMentions, setNotifMentions] = useState(true);
  const [notifFailures, setNotifFailures] = useState(true);
  const [notifDigest, setNotifDigest] = useState(false);

  // Workspace settings state (Screenshot 2)
  const [workspaceName, setWorkspaceName] = useState('Northlight Studio');
  const [timezone, setTimezone] = useState('Europe/Lisbon');
  const [weekStart, setWeekStart] = useState<number>(1);
  const [shortenLinks, setShortenLinks] = useState(true);
  const [utmEnabled, setUtmEnabled] = useState(true);
  const [utmSource, setUtmSource] = useState('murmura');

  // Approvals mode state (Screenshot 3)
  const [approvalMode, setApprovalMode] = useState<'BY_ROLE' | 'EVERY_POST' | 'OFF'>('BY_ROLE');

  // Security state (Screenshot 4)
  const [require2FA, setRequire2FA] = useState(false);
  const [sessions, setSessions] = useState([
    { id: 's1', name: 'MacBook Pro · Chrome', location: 'Lisbon, Portugal', time: 'active now', isCurrent: true, icon: 'monitor' },
    { id: 's2', name: 'iPhone · Murmura app', location: 'Lisbon, Portugal', time: '2 h ago', isCurrent: false, icon: 'phone' },
    { id: 's3', name: 'iPad · Safari', location: 'Porto, Portugal', time: '3 d ago', isCurrent: false, icon: 'tablet' },
    { id: 's4', name: 'Windows PC · Edge', location: 'Austin, United States', time: '6 d ago', isCurrent: false, icon: 'monitor' },
  ]);

  // Billing state (Screenshots 5 & 6)
  const [currentPlan, setCurrentPlan] = useState<'starter' | 'growth' | 'agency'>('agency');
  const [seats, setSeats] = useState(15);

  // Appearance state
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark' | 'system') || 'light';
  });

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    const resolved =
      newTheme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : newTheme;
    document.documentElement.setAttribute('data-theme', resolved);
    if (resolved === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    addToast({ type: 'info', message: `Theme switched to ${newTheme}` });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  // Nav Items
  const navItems = [
    {
      id: 'profile',
      label: 'Profile',
      icon: (
        <svg className="ico" viewBox="0 0 24 24">
          <circle cx="12" cy="7" r="4" />
          <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
        </svg>
      ),
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: (
        <svg className="ico" viewBox="0 0 24 24">
          <path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z" />
          <path d="M10 20.5a2 2 0 0 0 4 0" />
        </svg>
      ),
    },
    {
      id: 'workspace',
      label: 'Workspace',
      icon: (
        <svg className="ico" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" />
          <path d="M3.6 9h16.8M3.6 15h16.8M11.5 3a17 17 0 0 0 0 18M12.5 3a17 17 0 0 1 0 18" />
        </svg>
      ),
    },
    {
      id: 'approvals',
      label: 'Approvals',
      icon: (
        <svg className="ico" viewBox="0 0 24 24">
          <path d="M12 3.5 5 6v5.5c0 4.4 3 7.9 7 9 4-1.1 7-4.6 7-9V6z" />
          <path d="m9 12 2.2 2.2L15.5 10" />
        </svg>
      ),
    },
    {
      id: 'security',
      label: 'Security',
      icon: (
        <svg className="ico" viewBox="0 0 24 24">
          <circle cx="8" cy="15" r="4" />
          <path d="m10.8 12.2 5.2-5.2M16 7l2 2M14 9l2 2" />
        </svg>
      ),
    },
    {
      id: 'billing',
      label: 'Billing',
      icon: (
        <svg className="ico" viewBox="0 0 24 24">
          <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
          <path d="M3 10h18M7 15h3" />
        </svg>
      ),
    },
    {
      id: 'appearance',
      label: 'Appearance',
      icon: (
        <svg className="ico" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
        </svg>
      ),
    },
    {
      id: 'data',
      label: 'Data',
      icon: (
        <svg className="ico" viewBox="0 0 24 24">
          <path d="M12 3v13M7 11l5 5 5-5M4 19h16" />
        </svg>
      ),
    },
  ];

  // Active alerts count
  const activeAlertsCount = (notifApprovals ? 1 : 0) + (notifMentions ? 1 : 0) + (notifFailures ? 1 : 0) + (notifDigest ? 1 : 0);

  // Calculated billing monthly cost
  const billingMonthlyTotal = currentPlan === 'starter' ? 29 : currentPlan === 'growth' ? 99 : 249 + Math.max(0, seats - 10) * 15;

  return (
    <div data-view="settings" className="view" style={{ minWidth: 0 }}>
      {/* 1. Header with Top Stats Strip */}
      <header className="head">
        <div className="head__lead">
          <h1 className="head__title">Settings</h1>
        </div>

        <div className="head__stats">
          {/* Stat 1: 3 People need approval */}
          <div className="stat" data-stat="need">
            <span className="stat__ico">
              <svg className="ico" viewBox="0 0 24 24">
                <path d="M12 3.5 5 6v5.5c0 4.4 3 7.9 7 9 4-1.1 7-4.6 7-9V6z" />
                <path d="m9 12 2.2 2.2L15.5 10" />
              </svg>
            </span>
            <span className="stat__value">
              <b className="num tnum">{approvalMode === 'OFF' ? '0' : '3'}</b>
            </span>
            <span className="stat__label">People need approval</span>
          </div>

          {/* Stat 2: 3 Alerts switched on */}
          <div className="stat" data-stat="alerts">
            <span className="stat__ico">
              <svg className="ico" viewBox="0 0 24 24">
                <path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z" />
                <path d="M10 20.5a2 2 0 0 0 4 0" />
              </svg>
            </span>
            <span className="stat__value">
              <b className="num tnum">{activeAlertsCount}</b>
            </span>
            <span className="stat__label">Alerts switched on</span>
          </div>

          {/* Stat 3: $324 Agency plan, per month */}
          <div className="stat" data-stat="bill">
            <span className="stat__ico">
              <svg className="ico" viewBox="0 0 24 24">
                <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
                <path d="M3 10h18M7 15h3" />
              </svg>
            </span>
            <span className="stat__value">
              <b className="num tnum">${billingMonthlyTotal}</b>
            </span>
            <span className="stat__label">
              {currentPlan === 'agency' ? 'Agency plan, per month' : `${currentPlan} plan`}
            </span>
          </div>
        </div>
      </header>

      {/* 2. Main Settings Layout: Sidebar + Content */}
      <div className="st-grid">
        {/* Left Sidebar */}
        <aside className="card st-side" aria-label="Settings navigation">
          {/* User Identity Box */}
          <div className="st-me">
            <img
              src="/images/camila.jpg"
              className="av av--lg"
              alt={profileName}
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div>
              <b>{profileName}</b>
              <span className="rbadge rbadge--ink">{role || 'Owner'}</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="st-navwrap" aria-label="Settings sections">
            <div className="st-nav" role="tablist">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="st-tab"
                  role="tab"
                  aria-current={activeTab === item.id ? 'page' : undefined}
                  onClick={() => handleTabChange(item.id as any)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </nav>
        </aside>

        {/* Main Settings Card */}
        <section className="card st-main">
          {/* TAB 1: NOTIFICATIONS (Screenshot 1) */}
          {activeTab === 'notifications' && (
            <div className="st-panel">
              <header className="st-sec">
                <div>
                  <h2>Notifications</h2>
                  <p className="card__sub">What Murmura tells you about</p>
                </div>
              </header>

              <ul className="st-list">
                {/* 1. Approval requests */}
                <li className="st-item">
                  <div className="st-item__ico">
                    <svg className="ico" viewBox="0 0 24 24">
                      <path d="M12 3.5 5 6v5.5c0 4.4 3 7.9 7 9 4-1.1 7-4.6 7-9V6z" />
                      <path d="m9 12 2.2 2.2L15.5 10" />
                    </svg>
                  </div>
                  <div className="st-item__t">
                    <b>Approval requests</b>
                    <small>When a post is waiting for you, or yours is approved or sent back.</small>
                  </div>
                  <button
                    type="button"
                    className="switch"
                    role="switch"
                    aria-checked={notifApprovals}
                    onClick={() => {
                      setNotifApprovals(!notifApprovals);
                      addToast({ type: 'info', message: !notifApprovals ? 'Approval notifications enabled' : 'Approval notifications muted' });
                    }}
                  />
                </li>

                {/* 2. Mentions and replies */}
                <li className="st-item">
                  <div className="st-item__ico">
                    <svg className="ico" viewBox="0 0 24 24">
                      <path d="M4.5 18.5 5.6 15A7.5 7.5 0 1 1 9 18.2z" />
                    </svg>
                  </div>
                  <div className="st-item__t">
                    <b>Mentions and replies</b>
                    <small>When someone mentions a brand or replies to a thread you’re on.</small>
                  </div>
                  <button
                    type="button"
                    className="switch"
                    role="switch"
                    aria-checked={notifMentions}
                    onClick={() => {
                      setNotifMentions(!notifMentions);
                      addToast({ type: 'info', message: !notifMentions ? 'Mention notifications enabled' : 'Mention notifications muted' });
                    }}
                  />
                </li>

                {/* 3. Publishing failures */}
                <li className="st-item">
                  <div className="st-item__ico">
                    <svg className="ico" viewBox="0 0 24 24">
                      <path d="M12 4 2.8 19.5h18.4z" />
                      <path d="M12 10v4.5M12 17h.01" />
                    </svg>
                  </div>
                  <div className="st-item__t">
                    <b>Publishing failures</b>
                    <small>When a post fails or a channel needs reconnecting.</small>
                  </div>
                  <button
                    type="button"
                    className="switch"
                    role="switch"
                    aria-checked={notifFailures}
                    onClick={() => {
                      setNotifFailures(!notifFailures);
                      addToast({ type: 'info', message: !notifFailures ? 'Failure alerts enabled' : 'Failure alerts muted' });
                    }}
                  />
                </li>

                {/* 4. Weekly digest */}
                <li className="st-item">
                  <div className="st-item__ico">
                    <svg className="ico" viewBox="0 0 24 24">
                      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
                      <path d="m4 7 8 6 8-6" />
                    </svg>
                  </div>
                  <div className="st-item__t">
                    <b>Weekly digest</b>
                    <small>A Monday email with last week’s numbers for your brands.</small>
                  </div>
                  <button
                    type="button"
                    className="switch"
                    role="switch"
                    aria-checked={notifDigest}
                    onClick={() => {
                      setNotifDigest(!notifDigest);
                      addToast({ type: 'info', message: !notifDigest ? 'Weekly digest subscribed' : 'Weekly digest unsubscribed' });
                    }}
                  />
                </li>
              </ul>

              {/* Footer Notice */}
              <p className="st-note">
                <svg className="ico" viewBox="0 0 24 24">
                  <path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z" />
                  <path d="M10 20.5a2 2 0 0 0 4 0" />
                </svg>
                <span>
                  You’ll hear about{' '}
                  {[
                    notifApprovals && 'approval requests',
                    notifMentions && 'mentions and replies',
                    notifFailures && 'publishing failures',
                    notifDigest && 'weekly digest',
                  ]
                    .filter(Boolean)
                    .join(', ') || 'nothing (all alerts disabled)'}
                  .
                </span>
              </p>
            </div>
          )}

          {/* TAB 2: WORKSPACE (Screenshot 2) */}
          {activeTab === 'workspace' && (
            <div className="st-panel">
              <header className="st-sec">
                <div>
                  <h2>Workspace</h2>
                  <p className="card__sub">Name, time zone, links</p>
                </div>
              </header>

              <div className="st-fields">
                <label className="field st-field">
                  <span className="field__label st-label">Workspace name</span>
                  <input
                    type="text"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    className="input"
                  />
                </label>

                <label className="field st-field">
                  <span className="field__label st-label">Time zone</span>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="input"
                  >
                    <option value="Europe/Lisbon">Lisbon · 8:19 AM</option>
                    <option value="Europe/London">London · 8:19 AM</option>
                    <option value="Europe/Copenhagen">Copenhagen · 9:19 AM</option>
                    <option value="America/New_York">New York · 3:19 AM</option>
                    <option value="Asia/Dubai">Dubai · 11:19 AM</option>
                    <option value="Asia/Tokyo">Tokyo · 4:19 PM</option>
                  </select>
                  <small style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 4, display: 'block' }}>
                    Schedules and reports use this clock.
                  </small>
                </label>
              </div>

              <ul className="st-list">
                {/* Week starts on */}
                <li className="st-item">
                  <div className="st-item__ico">
                    <svg className="ico" viewBox="0 0 24 24">
                      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
                      <path d="M3.5 10h17M8 3v4M16 3v4" />
                    </svg>
                  </div>
                  <div className="st-item__t">
                    <b>Week starts on</b>
                    <small>The calendar and weekly reports follow this.</small>
                  </div>
                  <div className="seg">
                    <button
                      type="button"
                      className={`seg__btn ${weekStart === 1 ? 'active' : ''}`}
                      aria-pressed={weekStart === 1}
                      onClick={() => {
                        setWeekStart(1);
                        addToast({ type: 'success', message: 'Weeks set to start on Monday' });
                      }}
                    >
                      Monday
                    </button>
                    <button
                      type="button"
                      className={`seg__btn ${weekStart === 0 ? 'active' : ''}`}
                      aria-pressed={weekStart === 0}
                      onClick={() => {
                        setWeekStart(0);
                        addToast({ type: 'success', message: 'Weeks set to start on Sunday' });
                      }}
                    >
                      Sunday
                    </button>
                  </div>
                </li>

                {/* Shorten links */}
                <li className="st-item">
                  <div className="st-item__ico">
                    <svg className="ico" viewBox="0 0 24 24">
                      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
                    </svg>
                  </div>
                  <div className="st-item__t">
                    <b>Shorten links</b>
                    <small>Long links in posts become mrmr.co links that count clicks.</small>
                  </div>
                  <button
                    type="button"
                    className="switch"
                    role="switch"
                    aria-checked={shortenLinks}
                    onClick={() => {
                      setShortenLinks(!shortenLinks);
                      addToast({ type: 'info', message: !shortenLinks ? 'Link shortening enabled' : 'Link shortening disabled' });
                    }}
                  />
                </li>

                {/* Add UTM tags */}
                <li className="st-item">
                  <div className="st-item__ico">
                    <svg className="ico" viewBox="0 0 24 24">
                      <path d="M9.5 4 7.5 20M16.5 4l-2 16M4.5 9h16M3.5 15h16" />
                    </svg>
                  </div>
                  <div className="st-item__t">
                    <b>Add UTM tags</b>
                    <small>Tag every link so web analytics knows it came from social.</small>
                  </div>
                  <button
                    type="button"
                    className="switch"
                    role="switch"
                    aria-checked={utmEnabled}
                    onClick={() => {
                      setUtmEnabled(!utmEnabled);
                      addToast({ type: 'info', message: !utmEnabled ? 'UTM tagging enabled' : 'UTM tagging disabled' });
                    }}
                  />
                </li>
              </ul>

              {/* UTM Source */}
              <div style={{ maxWidth: 420, marginTop: 4 }}>
                <label className="field st-field">
                  <span className="field__label st-label">UTM source</span>
                  <input
                    type="text"
                    value={utmSource}
                    onChange={(e) => setUtmSource(e.target.value)}
                    className="input"
                  />
                </label>
              </div>

              {/* URL Preview */}
              <div className="st-preview">
                <span className="card__sub">A link in a post will look like</span>
                <code>
                  https://mrmr.co/k8Qx2?utm_source={utmSource}&amp;utm_medium=social&amp;utm_campaign=autumn-harvest
                </code>
              </div>
            </div>
          )}

          {/* TAB 3: APPROVALS (Screenshot 3) */}
          {activeTab === 'approvals' && (
            <div className="st-panel">
              <header className="st-sec">
                <div>
                  <h2>Approvals</h2>
                  <p className="card__sub">Who needs a second pair of eyes</p>
                </div>
              </header>

              {/* 3 Modes Grid */}
              <div className="st-rules">
                {/* 1. By role */}
                <button
                  type="button"
                  className="st-rule st-rule--butter"
                  aria-checked={approvalMode === 'BY_ROLE'}
                  onClick={() => {
                    setApprovalMode('BY_ROLE');
                    addToast({ type: 'success', message: 'Approvals rule set to By role' });
                  }}
                >
                  <div className="st-rule__ico">
                    <svg className="ico" viewBox="0 0 24 24">
                      <circle cx="8" cy="15" r="4" />
                      <path d="m11 12 8.5-8.5M16.5 6.5l2 2M14.5 8.5l1.5 1.5" />
                    </svg>
                  </div>
                  <div className="st-rule__dot">
                    <i />
                  </div>
                  <b>By role</b>
                  <small>People whose role can’t “Publish without approval” send posts to an approver.</small>
                </button>

                {/* 2. Every post */}
                <button
                  type="button"
                  className="st-rule st-rule--coral"
                  aria-checked={approvalMode === 'EVERY_POST'}
                  onClick={() => {
                    setApprovalMode('EVERY_POST');
                    addToast({ type: 'success', message: 'Approvals rule set to Every post' });
                  }}
                >
                  <div className="st-rule__ico">
                    <svg className="ico" viewBox="0 0 24 24">
                      <path d="M12 3.5 5 6v5.5c0 4.4 3 7.9 7 9 4-1.1 7-4.6 7-9V6z" />
                      <path d="m9 12 2.2 2.2L15.5 10" />
                    </svg>
                  </div>
                  <div className="st-rule__dot">
                    <i />
                  </div>
                  <b>Every post</b>
                  <small>Every post needs an approver — even a manager’s. Only admins skip it.</small>
                </button>

                {/* 3. No approvals */}
                <button
                  type="button"
                  className="st-rule st-rule--pine"
                  aria-checked={approvalMode === 'OFF'}
                  onClick={() => {
                    setApprovalMode('OFF');
                    addToast({ type: 'success', message: 'Approvals disabled' });
                  }}
                >
                  <div className="st-rule__ico">
                    <svg className="ico" viewBox="0 0 24 24">
                      <path d="M13 3 5 13.5h6L10.5 21 19 10h-6z" />
                    </svg>
                  </div>
                  <div className="st-rule__dot">
                    <i />
                  </div>
                  <b>No approvals</b>
                  <small>Anyone who can write a post can publish it straight away.</small>
                </button>
              </div>

              {/* Dynamic Summary */}
              <p className="st-live">
                Right now, <b>3 people need approval</b>: Nia, Omar, Freya.
              </p>

              {/* 2 Columns: Need Approval vs Publish Directly */}
              <div className="st-people">
                {/* Col 1: Need Approval */}
                <div className="st-pcol">
                  <h3>
                    <svg className="ico" viewBox="0 0 24 24">
                      <path d="M12 3.5 5 6v5.5c0 4.4 3 7.9 7 9 4-1.1 7-4.6 7-9V6z" />
                      <path d="m9 12 2.2 2.2L15.5 10" />
                    </svg>
                    <span>Need approval</span>
                    <b>3</b>
                  </h3>
                  <ul>
                    <li className="st-pchip">
                      <span className="av av--xs av--t0">NO</span>
                      <span>Nia <small>Editor</small></span>
                    </li>
                    <li className="st-pchip">
                      <span className="av av--xs av--t1">OS</span>
                      <span>Omar <small>Editor</small></span>
                    </li>
                    <li className="st-pchip">
                      <span className="av av--xs av--t2">FN</span>
                      <span>Freya <small>Editor</small></span>
                    </li>
                  </ul>
                </div>

                {/* Col 2: Publish Directly */}
                <div className="st-pcol">
                  <h3>
                    <svg className="ico" viewBox="0 0 24 24">
                      <path d="M20.5 3.5 3.5 10.6l6.6 2.8 2.8 6.6z" />
                      <path d="m10.1 13.4 4.2-4.2" />
                    </svg>
                    <span>Publish directly</span>
                    <b>4</b>
                  </h3>
                  <ul>
                    <li className="st-pchip">
                      <img src="/images/camila.jpg" className="av av--xs" alt="Camila" />
                      <span>Camila <small>Owner</small></span>
                    </li>
                    <li className="st-pchip">
                      <span className="av av--xs av--t3">MJ</span>
                      <span>Malik <small>Admin</small></span>
                    </li>
                    <li className="st-pchip">
                      <span className="av av--xs av--t0">EM</span>
                      <span>Elise <small>Manager</small></span>
                    </li>
                    <li className="st-pchip">
                      <span className="av av--xs av--t1">HS</span>
                      <span>Haruto <small>Manager</small></span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Note */}
              <p className="st-note">
                <svg className="ico" viewBox="0 0 24 24">
                  <circle cx="9" cy="8.5" r="3.5" />
                  <path d="M3 19.5c.6-3.2 3-5 6-5s5.4 1.8 6 5" />
                </svg>
                <span>
                  6 people can approve: Camila, Malik, Elise, Haruto, Kwame, Peter.{' '}
                  <a href="#/team" onClick={() => addToast({ type: 'info', message: 'Jumped to Team & roles matrix' })}>
                    Change who can on the roles matrix.
                  </a>
                </span>
              </p>
            </div>
          )}

          {/* TAB 4: SECURITY (Screenshot 4) */}
          {activeTab === 'security' && (
            <div className="st-panel">
              <header className="st-sec">
                <div>
                  <h2>Security</h2>
                  <p className="card__sub">Two-factor and sessions</p>
                </div>
              </header>

              {/* Require 2FA Row */}
              <ul className="st-list">
                <li className="st-item">
                  <div className="st-item__ico">
                    <svg className="ico" viewBox="0 0 24 24">
                      <path d="M12 3.5 5 6v5.5c0 4.4 3 7.9 7 9 4-1.1 7-4.6 7-9V6z" />
                      <path d="m9 12 2.2 2.2L15.5 10" />
                    </svg>
                  </div>
                  <div className="st-item__t">
                    <b>Require two-factor for everyone</b>
                    <small>People without it are asked to set it up the next time they sign in.</small>
                  </div>
                  <button
                    type="button"
                    className="switch"
                    role="switch"
                    aria-checked={require2FA}
                    onClick={() => {
                      setRequire2FA(!require2FA);
                      addToast({ type: 'info', message: !require2FA ? '2FA required for agency' : '2FA made optional' });
                    }}
                  />
                </li>
              </ul>

              {/* 2FA Coverage Card */}
              <div className="st-cover">
                <div className="st-cover__num">
                  <b>64%</b>
                  <span>of active people use two-factor</span>
                </div>
                <div className="meter" style={{ height: 8 }}>
                  <span
                    className="meter__fill meter__fill--pine"
                    style={{ transform: 'scaleX(0.64)', transformOrigin: '0 50%' }}
                  />
                </div>
                <div className="st-cover__who">
                  <div className="av-stack">
                    <span className="av av--xs av--t2">FN</span>
                    <span className="av av--xs av--t0">LZ</span>
                    <span className="av av--xs av--t1">KA</span>
                    <span className="av av--xs av--t3">PL</span>
                  </div>
                  <span className="card__sub">
                    Freya, Lin, Kwame, Peter haven’t set it up
                  </span>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    style={{ marginLeft: 'auto' }}
                    onClick={() => addToast({ type: 'success', message: 'Reminder sent to 4 members' })}
                  >
                    <svg className="ico" viewBox="0 0 24 24">
                      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
                      <path d="m4 7 8 6 8-6" />
                    </svg>
                    Send a reminder
                  </button>
                </div>
              </div>

              {/* Sessions Subhead */}
              <div className="st-subhead">
                <h3>Your active sessions</h3>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => {
                    setSessions((prev) => prev.filter((s) => s.isCurrent));
                    addToast({ type: 'info', message: 'Signed out of 3 other sessions' });
                  }}
                >
                  <svg className="ico" viewBox="0 0 24 24">
                    <path d="M14.5 4.5h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-3M10 16.5 5.5 12 10 7.5M5.5 12h10" />
                  </svg>
                  Sign out everywhere else
                </button>
              </div>

              {/* Sessions List */}
              <div className="st-sessions">
                {sessions.map((sess) => (
                  <div key={sess.id} className="st-session">
                    <div className="st-item__ico">
                      {sess.icon === 'phone' ? (
                        <svg className="ico" viewBox="0 0 24 24">
                          <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
                          <path d="M11 18.5h2" />
                        </svg>
                      ) : sess.icon === 'tablet' ? (
                        <svg className="ico" viewBox="0 0 24 24">
                          <rect x="4" y="3" width="16" height="18" rx="2" />
                          <circle cx="12" cy="18" r="1" />
                        </svg>
                      ) : (
                        <svg className="ico" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="9" />
                          <path d="M3.6 9h16.8M3.6 15h16.8" />
                        </svg>
                      )}
                    </div>
                    <div className="st-item__t">
                      <b>
                        {sess.name}
                        {sess.isCurrent && (
                          <span className="badge badge--pine">This device</span>
                        )}
                      </b>
                      <small>{sess.location} · {sess.time}</small>
                    </div>
                    {!sess.isCurrent && (
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => {
                          setSessions((prev) => prev.filter((s) => s.id !== sess.id));
                          addToast({ type: 'info', message: `Signed out of ${sess.name}` });
                        }}
                      >
                        Sign out
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: BILLING (Screenshots 5 & 6) */}
          {activeTab === 'billing' && (
            <div className="st-panel">
              <header className="st-sec">
                <div>
                  <h2>Billing</h2>
                  <p className="card__sub">Plan, seats and invoices</p>
                </div>
                <span className="badge badge--ink" style={{ alignSelf: 'center' }}>
                  Agency plan
                </span>
              </header>

              {/* 3 Plans Grid */}
              <div className="st-plans" role="radiogroup" aria-label="Plan">
                {/* 1. Starter */}
                <div className={`st-plan ${currentPlan === 'starter' ? 'is-current tone--ink' : ''}`}>
                  <div className="st-plan__top">
                    <b>Starter</b>
                    {currentPlan === 'starter' && <span className="badge badge--butter">Current</span>}
                  </div>
                  <p className="st-plan__price">
                    <b>$29</b>
                    <span>/ month</span>
                  </p>
                  <p className="st-plan__lim">
                    2 seats included · then $12/seat<br />
                    5 channels · 1 brand
                  </p>
                  <ul className="st-plan__perks">
                    <li>
                      <svg className="ico" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
                      Scheduling and calendar
                    </li>
                    <li>
                      <svg className="ico" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
                      Unified inbox
                    </li>
                    <li>
                      <svg className="ico" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
                      30-day analytics
                    </li>
                  </ul>
                  {currentPlan === 'starter' ? (
                    <span className="st-plan__here">Your plan</span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn--sm btn--ghost"
                      onClick={() => {
                        setCurrentPlan('starter');
                        addToast({ type: 'info', message: 'Switched to Starter' });
                      }}
                    >
                      Switch to Starter
                    </button>
                  )}
                </div>

                {/* 2. Growth */}
                <div className={`st-plan ${currentPlan === 'growth' ? 'is-current tone--ink' : ''}`}>
                  <div className="st-plan__top">
                    <b>Growth</b>
                    {currentPlan === 'growth' && <span className="badge badge--butter">Current</span>}
                  </div>
                  <p className="st-plan__price">
                    <b>$99</b>
                    <span>/ month</span>
                  </p>
                  <p className="st-plan__lim">
                    5 seats included · then $14/seat<br />
                    20 channels · 5 brands
                  </p>
                  <ul className="st-plan__perks">
                    <li>
                      <svg className="ico" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
                      Everything in Starter
                    </li>
                    <li>
                      <svg className="ico" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
                      Approval workflows
                    </li>
                    <li>
                      <svg className="ico" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
                      Listening for 10 keywords
                    </li>
                  </ul>
                  {currentPlan === 'growth' ? (
                    <span className="st-plan__here">Your plan</span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn--sm btn--ghost"
                      onClick={() => {
                        setCurrentPlan('growth');
                        addToast({ type: 'info', message: 'Switched to Growth' });
                      }}
                    >
                      Switch to Growth
                    </button>
                  )}
                </div>

                {/* 3. Agency (Active Current) */}
                <div className={`st-plan ${currentPlan === 'agency' ? 'is-current tone--ink' : ''}`}>
                  <div className="st-plan__top">
                    <b>Agency</b>
                    <span className="badge badge--butter">Current</span>
                  </div>
                  <p className="st-plan__price">
                    <b>$249</b>
                    <span>/ month</span>
                  </p>
                  <p className="st-plan__lim">
                    10 seats included · then $15/seat<br />
                    Unlimited channels · unlimited brands
                  </p>
                  <ul className="st-plan__perks">
                    <li>
                      <svg className="ico" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
                      Everything in Growth
                    </li>
                    <li>
                      <svg className="ico" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
                      Custom roles and client access
                    </li>
                    <li>
                      <svg className="ico" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
                      Audit log and SSO
                    </li>
                  </ul>
                  <span className="st-plan__here">Your plan</span>
                </div>
              </div>

              {/* Seats Stepper Box */}
              <div className="st-seats" data-row>
                <div className="st-item__t">
                  <b>Seats</b>
                  <small>
                    12 in use · 10 included · max 60 on Agency
                  </small>
                </div>
                <div className="st-stepper">
                  <button
                    type="button"
                    className="ibtn"
                    aria-label="Remove a seat"
                    disabled={seats <= 12}
                    onClick={() => {
                      if (seats > 12) {
                        setSeats(seats - 1);
                        addToast({ type: 'info', message: `Seats adjusted to ${seats - 1}` });
                      } else {
                        addToast({ type: 'error', message: 'Cannot reduce seats below active user count (12 in use)' });
                      }
                    }}
                  >
                    <svg className="ico" viewBox="0 0 24 24"><path d="M5 12h14" /></svg>
                  </button>
                  <b aria-live="polite">{seats}</b>
                  <button
                    type="button"
                    className="ibtn"
                    aria-label="Add a seat"
                    disabled={seats >= 60}
                    onClick={() => {
                      setSeats(seats + 1);
                      addToast({ type: 'success', message: `Added seat: total ${seats + 1}` });
                    }}
                  >
                    <svg className="ico" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
                  </button>
                </div>
                <div className="st-seats__total">
                  <small>Monthly total</small>
                  <b>${billingMonthlyTotal}</b>
                </div>
              </div>

              {/* Next Charge Card */}
              <p className="st-note">
                <svg className="ico" viewBox="0 0 24 24">
                  <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
                  <path d="M3.5 10h17M8 3v4M16 3v4" />
                </svg>
                <span>
                  Next charge <b>${billingMonthlyTotal}</b> on Nov 1, 2026 to Visa ending 4242.
                </span>
              </p>

              {/* Invoices List */}
              <div className="st-subhead">
                <h3>Invoices</h3>
              </div>
              <ul className="st-invoices">
                {[
                  { id: 'NL-202610', month: 'October 2026', total: '$324', amount: 324 },
                  { id: 'NL-202609', month: 'September 2026', total: '$324', amount: 324 },
                  { id: 'NL-202608', month: 'August 2026', total: '$324', amount: 324 },
                  { id: 'NL-202607', month: 'July 2026', total: '$294', amount: 294 },
                  { id: 'NL-202606', month: 'June 2026', total: '$294', amount: 294 },
                  { id: 'NL-202605', month: 'May 2026', total: '$294', amount: 294 },
                ].map((inv) => (
                  <li key={inv.id} data-row>
                    <span className="st-item__ico">
                      <svg className="ico" viewBox="0 0 24 24">
                        <path d="M5 4.5h14v10l-5 5H5z" />
                        <path d="M14 19.5v-5h5M8.5 9h7M8.5 12.5h4" />
                      </svg>
                    </span>
                    <div className="st-item__t">
                      <b>{inv.month}</b>
                      <small>{inv.id} · {inv.total}</small>
                    </div>
                    <span className="spill spill--pine">
                      <i></i>Paid
                    </span>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => handleDownloadInvoice(inv)}
                    >
                      <svg className="ico" viewBox="0 0 24 24">
                        <path d="M12 4v11.5M7 10.5l5 5 5-5M5 20h14" />
                      </svg>
                      Download
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* TAB 6: PROFILE */}
          {activeTab === 'profile' && (
            <div className="st-panel">
              <header className="st-sec">
                <div>
                  <h2>Profile</h2>
                  <p className="card__sub">Your name, title and photo</p>
                </div>
              </header>

              <div className="st-profile">
                {/* Profile Card Header */}
                <div className="st-face">
                  <img
                    src="/images/camila.jpg"
                    className="av av--xl"
                    alt={profileName}
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="st-face__t">
                    <b>{profileName}</b>
                    <span className="rbadge rbadge--ink">{role || 'Owner'}</span>
                    <div className="seg st-face__seg" role="group">
                      <button
                        type="button"
                        className={`seg__btn ${avatarMode === 'photo' ? 'active' : ''}`}
                        aria-pressed={avatarMode === 'photo'}
                        onClick={() => setAvatarMode('photo')}
                      >
                        Photo
                      </button>
                      <button
                        type="button"
                        className={`seg__btn ${avatarMode === 'initials' ? 'active' : ''}`}
                        aria-pressed={avatarMode === 'initials'}
                        onClick={() => setAvatarMode('initials')}
                      >
                        Initials
                      </button>
                    </div>
                  </div>
                </div>

                {/* Form Input Fields */}
                <div className="st-fields">
                  <label className="field st-field">
                    <span className="field__label st-label">Full name</span>
                    <input
                      type="text"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="input"
                    />
                  </label>

                  <label className="field st-field">
                    <span className="field__label st-label">Job title</span>
                    <input
                      type="text"
                      value={profileTitle}
                      onChange={(e) => setProfileTitle(e.target.value)}
                      className="input"
                    />
                  </label>

                  <label className="field st-field">
                    <span className="field__label st-label">Work email</span>
                    <input
                      type="email"
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                      className="input"
                    />
                  </label>

                  <div className="field st-ro">
                    <span className="field__label">Role</span>
                    <p>
                      <span className="rbadge rbadge--ink">{role || 'Owner'}</span>
                      <span className="card__sub">Set by an admin on the Team page.</span>
                    </p>
                  </div>
                </div>

                {/* Access Cards Grid */}
                <div className="st-access">
                  <div>
                    <h3>
                      <svg className="ico" viewBox="0 0 24 24">
                        <path d="m12 4 8.5 4.5L12 13 3.5 8.5z" />
                        <path d="m3.5 12.5 8.5 4.5 8.5-4.5M3.5 16.5 12 21l8.5-4.5" />
                      </svg>
                      <span>Brands you can see</span>
                    </h3>
                    <div className="st-access__brands">
                      {[
                        { code: 'EO', name: 'Ember & Oak', color: '#e06b53' },
                        { code: 'HH', name: 'Hollow Home', color: '#f2b740' },
                        { code: 'VG', name: 'Vantage Garage', color: '#1c1d22' },
                        { code: 'WB', name: 'Wildroot Botanics', color: '#2d7a5b' },
                        { code: 'NS', name: 'Northlight Studio', color: '#3b82f6' },
                      ].map((b) => (
                        <span key={b.code} className="bchip">
                          <span
                            className="bmark bmark--xs"
                            style={{ backgroundColor: b.color, color: '#fff' }}
                          >
                            {b.code}
                          </span>
                          {b.name}
                        </span>
                      ))}
                    </div>
                    <p className="card__sub">
                      Every brand, including new ones. You publish without approval.
                    </p>
                  </div>

                  <div>
                    <h3>
                      <svg className="ico" viewBox="0 0 24 24">
                        <circle cx="8" cy="15" r="4" />
                        <path d="m11 12 8.5-8.5M16.5 6.5l2 2M14.5 8.5l1.5 1.5" />
                      </svg>
                      <span>What your role can do</span>
                    </h3>
                    <ul className="st-access__perms">
                      {[
                        'Write posts', 'Publish without approval', 'Approve posts', 'Delete posts',
                        'Reschedule', 'Reply in inbox', 'Assign conversations', 'View analytics',
                        'Export reports', 'Manage listening', 'Manage library', 'Connect channels',
                        'Manage team & roles', 'Billing', 'Workspace settings'
                      ].map((perm) => (
                        <li key={perm} className="is-on">
                          <svg className="ico" viewBox="0 0 24 24">
                            <path d="m5 12.5 4.5 4.5L19 7.5" />
                          </svg>
                          <span>{perm}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: APPEARANCE */}
          {activeTab === 'appearance' && (
            <div className="st-panel">
              <header className="st-sec">
                <div>
                  <h2>Appearance</h2>
                  <p className="card__sub">Choose how Murmura looks on this device</p>
                </div>
              </header>

              <div className="st-themes">
                <button
                  type="button"
                  className="st-theme"
                  aria-checked={theme === 'light'}
                  onClick={() => handleThemeChange('light')}
                >
                  <span className="st-mock st-mock--light" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                  <b>Light</b>
                  <small>Warm cream and calm tones</small>
                </button>

                <button
                  type="button"
                  className="st-theme"
                  aria-checked={theme === 'dark'}
                  onClick={() => handleThemeChange('dark')}
                >
                  <span className="st-mock st-mock--dark" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                  <b>Dark</b>
                  <small>Deep ink and midnight glow</small>
                </button>

                <button
                  type="button"
                  className="st-theme"
                  aria-checked={theme === 'system'}
                  onClick={() => handleThemeChange('system')}
                >
                  <span className="st-mock st-mock--system" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                  <b>System</b>
                  <small>Follows your device theme</small>
                </button>
              </div>
            </div>
          )}

          {/* TAB 8: DATA */}
          {activeTab === 'data' && (
            <div className="st-panel">
              <header className="st-sec">
                <div>
                  <h2>Data &amp; Export</h2>
                  <p className="card__sub">Download complete archives of workspace posts and assets</p>
                </div>
              </header>

              <div style={{ display: 'grid', gap: 14 }}>
                <div className="st-item">
                  <div className="st-item__ico">
                    <svg className="ico" viewBox="0 0 24 24">
                      <path d="M12 4v11.5M7 10.5l5 5 5-5M5 20h14" />
                    </svg>
                  </div>
                  <div className="st-item__t">
                    <b>Export all workspace posts and reports</b>
                    <small>Generates a complete JSON archive of all content, schedules, and metrics.</small>
                  </div>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => addToast({ type: 'success', message: 'Workspace archive exported' })}
                  >
                    Export JSON
                  </button>
                </div>

                <div className="st-danger">
                  <div>
                    <b>Reset local workspace demo data</b>
                    <small>Clears cached changes and restores initial seeded posts and channels.</small>
                  </div>
                  <button
                    type="button"
                    className="btn btn--danger btn--sm"
                    onClick={() => {
                      localStorage.clear();
                      addToast({ type: 'info', message: 'Workspace cache reset. Reloading...' });
                      setTimeout(() => window.location.reload(), 600);
                    }}
                  >
                    Reset cache
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
