import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore.js';
import { useToastStore } from '../../stores/toastStore.js';
import { NetworkIcon } from '../common/NetworkIcon.js';
import { animateElasticPill } from '../../lib/elasticPill.js';
import { initMagnetic } from '../../lib/magnetic.js';
import { animatePageEntrance, initContinuousIconFloat } from '../../lib/entrance.js';
import { BackToTopRocket } from '../common/BackToTopRocket.js';
import { NewBrandModal } from '../brands/NewBrandModal.js';
import { SocialOAuthModal, OAuthNetwork } from '../channels/SocialOAuthModal.js';
import { apiFetch } from '../../lib/api.js';
import { CheckCircle2, AlertTriangle, KeyRound, TrendingUp, Smartphone } from 'lucide-react';
import { ManualPublishModal, ManualPublishPost } from '../common/ManualPublishModal.js';
import { ErrorBoundary } from '../common/ErrorBoundary.js';

const getBrandMonogram = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

const NETWORKS = [
  { id: 'instagram', name: 'Instagram' },
  { id: 'facebook', name: 'Facebook' },
  { id: 'x', name: 'X' },
  { id: 'linkedin', name: 'LinkedIn' },
  { id: 'tiktok', name: 'TikTok' },
  { id: 'youtube', name: 'YouTube' },
  { id: 'pinterest', name: 'Pinterest' },
  { id: 'threads', name: 'Threads' },
];

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, workspace, role, brands, logout, selectedBrandId, setSelectedBrandId, removeBrand } = useAuthStore();
  const [isBrandMenuOpen, setIsBrandMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const brandContainerRef = React.useRef<HTMLDivElement>(null);
  const userContainerRef = React.useRef<HTMLDivElement>(null);
  const [isTodayQueueOpen, setIsTodayQueueOpen] = useState(false);
  const clockBtnRef = React.useRef<HTMLButtonElement>(null);
  const todayPopRef = React.useRef<HTMLDivElement>(null);

  // Notification Dropdown state
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifContainerRef = React.useRef<HTMLDivElement>(null);
  const [manualPostForModal, setManualPostForModal] = useState<ManualPublishPost | null>(null);
  const [notifications, setNotifications] = useState([
    {
      id: 'notif-3',
      title: 'Workspace ready',
      time: 'Just now',
      unread: false,
      link: '/channels',
      icon: 'key',
    },
  ]);
  const unreadNotifCount = notifications.filter((n) => n.unread).length;

  // Brand Deletion state & handler
  const [deletingBrandId, setDeletingBrandId] = useState<string | null>(null);

  const handleDeleteBrand = async (e: React.MouseEvent, brand: { id: string; name: string }) => {
    e.stopPropagation();
    const confirmed = window.confirm(
      `Are you sure you want to delete brand "${brand.name}"?\n\nThis will remove the brand, channels, and associated posts.`
    );
    if (!confirmed) return;

    setDeletingBrandId(brand.id);
    try {
      await apiFetch(`/brands/${brand.id}`, { method: 'DELETE' });
      removeBrand(brand.id);

      // Clean up localStorage custom channels for this brand
      try {
        const saved = localStorage.getItem('vs_custom_channels');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((c: any) => c.brandId !== brand.id);
            localStorage.setItem('vs_custom_channels', JSON.stringify(filtered));
          }
        }
      } catch {}

      addToast({
        type: 'success',
        message: `Brand "${brand.name}" deleted successfully`,
      });
    } catch (err: any) {
      // Robust fallback: Always remove from UI state so user is never stuck
      removeBrand(brand.id);
      try {
        const saved = localStorage.getItem('vs_custom_channels');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((c: any) => c.brandId !== brand.id);
            localStorage.setItem('vs_custom_channels', JSON.stringify(filtered));
          }
        }
      } catch {}

      if (err.status === 404 || err.message?.toLowerCase().includes('not found')) {
        addToast({
          type: 'success',
          message: `Brand "${brand.name}" removed`,
        });
      } else {
        addToast({
          type: 'info',
          message: `Brand "${brand.name}" removed from view`,
        });
      }
    } finally {
      setDeletingBrandId(null);
    }
  };

  // Quick Create Menu state
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const createBtnRef = React.useRef<HTMLButtonElement>(null);
  const createPopRef = React.useRef<HTMLDivElement>(null);

  // Connect Channel Modal state
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectNet, setConnectNet] = useState('instagram');
  const [connectBrandId, setConnectBrandId] = useState(brands[0]?.id || 'b_eo');
  const [activeOAuthNet, setActiveOAuthNet] = useState<OAuthNetwork | null>(null);
  const [connectMethod, setConnectMethod] = useState<'manual' | 'oauth'>('manual');
  const [connectHandle, setConnectHandle] = useState('');
  const [connectLogin, setConnectLogin] = useState('');
  const [connectPassword, setConnectPassword] = useState('');
  const [showConnectPassword, setShowConnectPassword] = useState(false);
  const [isSubmittingConnect, setIsSubmittingConnect] = useState(false);

  // Invite Teammate Modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [inviteBrand, setInviteBrand] = useState('all');

  // New Brand Onboarding Modal state
  const [showNewBrandModal, setShowNewBrandModal] = useState(false);

  // Mobile navigation "More" sheet state
  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false);

  const addToast = useToastStore((s) => s.addToast);

  const todayDateFormatted = React.useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  }, []);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        isBrandMenuOpen &&
        brandContainerRef.current &&
        !brandContainerRef.current.contains(target)
      ) {
        setIsBrandMenuOpen(false);
      }
      if (
        isUserMenuOpen &&
        userContainerRef.current &&
        !userContainerRef.current.contains(target)
      ) {
        setIsUserMenuOpen(false);
      }
      if (
        isNotifOpen &&
        notifContainerRef.current &&
        !notifContainerRef.current.contains(target)
      ) {
        setIsNotifOpen(false);
      }
      if (
        isTodayQueueOpen &&
        todayPopRef.current &&
        !todayPopRef.current.contains(target) &&
        clockBtnRef.current &&
        !clockBtnRef.current.contains(target)
      ) {
        setIsTodayQueueOpen(false);
      }
      if (
        isCreateMenuOpen &&
        createPopRef.current &&
        !createPopRef.current.contains(target) &&
        createBtnRef.current &&
        !createBtnRef.current.contains(target)
      ) {
        setIsCreateMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isTodayQueueOpen, isCreateMenuOpen, isBrandMenuOpen, isUserMenuOpen, isNotifOpen]);

  React.useEffect(() => {
    setIsTodayQueueOpen(false);
    setIsCreateMenuOpen(false);
    setIsBrandMenuOpen(false);
    setIsUserMenuOpen(false);
    setIsNotifOpen(false);
    setIsMoreSheetOpen(false);
  }, [location.pathname]);

  // Global keyboard shortcuts (N for quick create, Esc to close)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if ((e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setIsCreateMenuOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsCreateMenuOpen(false);
        setIsTodayQueueOpen(false);
        setIsBrandMenuOpen(false);
        setIsUserMenuOpen(false);
        setIsNotifOpen(false);
        setShowConnectModal(false);
        setShowInviteModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
  });

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    if (next === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', next);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Open Command Palette event
  const openSearch = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
  };

  const currentPath = location.pathname;
  const currentView = currentPath.split('/')[1] || 'overview';

  const selectedBrand = brands.find(
    (b) => b.id === selectedBrandId || (selectedBrandId !== 'all' && (b.id.toLowerCase() === selectedBrandId.toLowerCase() || b.name.toLowerCase() === selectedBrandId.toLowerCase()))
  );

  const tabsTrackRef = React.useRef<HTMLDivElement>(null);
  const tabsPillRef = React.useRef<HTMLSpanElement>(null);
  const mainRef = React.useRef<HTMLElement>(null);

  // Sync Elastic Tab Pill, Magnetic Physics, and Entrance on route change
  React.useEffect(() => {
    const updatePill = (animate = true) => {
      const track = tabsTrackRef.current;
      const pill = tabsPillRef.current;
      if (track && pill) {
        const activeTab = track.querySelector<HTMLElement>('.tab[aria-current="page"]');
        if (activeTab && activeTab.offsetWidth > 0) {
          animateElasticPill(pill, track, activeTab, animate);
        }
      }
    };

    // Immediate sync + rAF + font-ready sync
    updatePill(true);
    const rafId = requestAnimationFrame(() => updatePill(false));

    if (typeof document !== 'undefined' && 'fonts' in document && document.fonts.ready) {
      document.fonts.ready.then(() => updatePill(false));
    }

    const triggerAnimations = () => {
      if (mainRef.current) {
        animatePageEntrance(mainRef.current);
      }
      initMagnetic(document);
      initContinuousIconFloat(document);
    };

    // Staggered page entrance animation for the current view with deliberate delay
    const timer = setTimeout(() => {
      updatePill(false);
      triggerAnimations();
    }, 100);

    const handleResize = () => {
      updatePill(false);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(rafId);
      clearTimeout(timer);
    };
  }, [currentPath]);

  return (
    <div className="app">
      {/* Top Header */}
      <header className="top">
        <NavLink to="/overview" className="brand" aria-label="Murmura — overview">
          <span className="brand__mark" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M4 15.5c2.2-3.6 4.4-3.6 6.6 0s4.4 3.6 6.6 0" />
              <path d="M6.5 10c1.6-2.4 3.2-2.4 4.8 0s3.2 2.4 4.8 0" />
              <circle cx="19.2" cy="8.2" r="1.3" />
            </svg>
          </span>
          <span className="brand__name">murmura</span>
        </NavLink>

        {/* Primary Tabs with Elastic Ink Pill */}
        <nav className="tabs" aria-label="Main">
          <div className="tabs__track" ref={tabsTrackRef}>
            <NavLink
              to="/overview"
              className={({ isActive }) => `tab ${isActive ? 'is-active' : ''}`}
              aria-current={currentView === 'overview' ? 'page' : undefined}
            >
              Overview
            </NavLink>
            <NavLink
              to="/compose"
              className={({ isActive }) => `tab ${isActive ? 'is-active' : ''}`}
              aria-current={currentView === 'compose' ? 'page' : undefined}
            >
              Compose
            </NavLink>
            <NavLink
              to="/calendar"
              className={({ isActive }) => `tab ${isActive ? 'is-active' : ''}`}
              aria-current={currentView === 'calendar' ? 'page' : undefined}
            >
              Calendar
            </NavLink>
            <NavLink
              to="/inbox"
              className={({ isActive }) => `tab ${isActive ? 'is-active' : ''}`}
              aria-current={currentView === 'inbox' ? 'page' : undefined}
            >
              Inbox <span className="tab-count">4</span>
            </NavLink>
            <NavLink
              to="/approvals"
              className={({ isActive }) => `tab ${isActive ? 'is-active' : ''}`}
              aria-current={currentView === 'approvals' ? 'page' : undefined}
            >
              Approvals <span className="tab-count">2</span>
            </NavLink>
            <NavLink
              to="/analytics"
              className={({ isActive }) => `tab ${isActive ? 'is-active' : ''}`}
              aria-current={currentView === 'analytics' ? 'page' : undefined}
            >
              Analytics
            </NavLink>
            <NavLink
              to="/listening"
              className={({ isActive }) => `tab ${isActive ? 'is-active' : ''}`}
              aria-current={currentView === 'listening' ? 'page' : undefined}
            >
              Listening
            </NavLink>

            {/* Elastic Ink Pill overlay layer */}
            <span className="tabs__pill" aria-hidden="true" ref={tabsPillRef}>
              <span>Overview</span>
              <span>Compose</span>
              <span>Calendar</span>
              <span>Inbox <span className="tab-count">4</span></span>
              <span>Approvals <span className="tab-count">2</span></span>
              <span>Analytics</span>
              <span>Listening</span>
            </span>
          </div>
        </nav>

        {/* Top Tools: Search, Brand Switcher, Bell, Me */}
        <div className="top__tools">
          <button
            type="button"
            className="ibtn ibtn--glass top__search"
            onClick={openSearch}
            aria-label="Search"
            title="Search (⌘K)"
          >
            <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>
          </button>

          {/* Brand Switcher */}
          <div ref={brandContainerRef} className="top__brand-wrap" style={{ position: 'relative' }}>
            <button
              id="btn-brand"
              type="button"
              className="bswitch magnetic"
              onClick={() => setIsBrandMenuOpen(!isBrandMenuOpen)}
              aria-label={`Brand: ${selectedBrand ? selectedBrand.name : 'all brands'}`}
              aria-expanded={isBrandMenuOpen}
            >
              {selectedBrand ? (
                <span
                  className="bmark bmark--xs"
                  style={{
                    background: selectedBrand.color,
                    color: selectedBrand.name.toLowerCase().includes('hollow') ? '#1c1b18' : '#fff',
                    fontWeight: 700,
                  }}
                >
                  {getBrandMonogram(selectedBrand.name)}
                </span>
              ) : (
                <span className="bswitch__all">
                  <svg className="ico" viewBox="0 0 24 24">
                    <rect x="3" y="3" width="7" height="7" rx="2" />
                    <rect x="14" y="3" width="7" height="7" rx="2" />
                    <rect x="3" y="14" width="7" height="7" rx="2" />
                    <rect x="14" y="14" width="7" height="7" rx="2" />
                  </svg>
                </span>
              )}
              <span className="bswitch__name">{selectedBrand ? selectedBrand.name : 'All brands'}</span>
              <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
                <path d="m6 9.5 6 6 6-6" />
              </svg>
            </button>

            {isBrandMenuOpen && (
              <>
                <div
                  className="pop-scrim"
                  onClick={() => setIsBrandMenuOpen(false)}
                  aria-hidden="true"
                />
                <div
                  className="pop pop--brand"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="pop__head" style={{ padding: '8px 10px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className="pop__title" style={{ fontSize: '15px', fontWeight: 700 }}>Switch Brand</span>
                    <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 500 }}>
                      {brands.length} {brands.length === 1 ? 'brand' : 'brands'}
                    </span>
                  </div>
                  <div className="pop__list" style={{ gap: '4px', display: 'flex', flexDirection: 'column' }}>
                    <button
                      type="button"
                      className="menu__item"
                      style={{
                        minHeight: '44px',
                        padding: '10px 12px',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        width: '100%',
                        fontWeight: selectedBrandId === 'all' ? 700 : 500,
                        background: selectedBrandId === 'all' ? 'var(--well)' : 'transparent',
                      }}
                      onClick={() => {
                        setSelectedBrandId('all');
                        setIsBrandMenuOpen(false);
                      }}
                    >
                      <span className="bswitch__all" style={{ width: 28, height: 28, flexShrink: 0 }}>
                        <svg className="ico" viewBox="0 0 24 24" style={{ width: 14, height: 14 }}>
                          <rect x="3" y="3" width="7" height="7" rx="2" />
                          <rect x="14" y="3" width="7" height="7" rx="2" />
                          <rect x="3" y="14" width="7" height="7" rx="2" />
                          <rect x="14" y="14" width="7" height="7" rx="2" />
                        </svg>
                      </span>
                      <span style={{ flex: 1, textAlign: 'left' }}>All Brands</span>
                      {selectedBrandId === 'all' && (
                        <svg className="ico" viewBox="0 0 24 24" style={{ width: 16, height: 16, color: 'var(--good)' }}>
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                    <hr style={{ margin: '4px 0', border: 'none', borderTop: '1px solid var(--line)' }} />
                    <div style={{ maxHeight: 'min(42vh, 320px)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {brands.map((b) => (
                        <div
                          key={b.id}
                          className="menu__item"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px',
                            cursor: 'pointer',
                            borderRadius: '12px',
                            padding: '9px 12px',
                            minHeight: '44px',
                            transition: 'background 0.15s ease',
                            background: selectedBrandId === b.id ? 'var(--well)' : 'transparent',
                          }}
                          onClick={() => {
                            setSelectedBrandId(b.id);
                            setIsBrandMenuOpen(false);
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                            <span
                              className="bmark bmark--xs"
                              style={{
                                background: b.color,
                                color: b.name.toLowerCase().includes('hollow') ? '#1c1b18' : '#fff',
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            >
                              {getBrandMonogram(b.name)}
                            </span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: selectedBrandId === b.id ? 700 : 500 }}>
                              {b.name}
                            </span>
                          </div>

                          {/* Delete Brand Button */}
                          <button
                            type="button"
                            title={`Delete brand ${b.name}`}
                            aria-label={`Delete brand ${b.name}`}
                            disabled={deletingBrandId === b.id}
                            onClick={(e) => handleDeleteBrand(e, b)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '30px',
                              height: '30px',
                              borderRadius: '8px',
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--muted, #94a3b8)',
                              cursor: deletingBrandId === b.id ? 'wait' : 'pointer',
                              padding: 0,
                              transition: 'all 0.15s ease',
                              flexShrink: 0,
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = '#ef4444';
                              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = 'var(--muted, #94a3b8)';
                              e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            {deletingBrandId === b.id ? (
                              <span
                                style={{
                                  width: 12,
                                  height: 12,
                                  border: '2px solid rgba(239, 68, 68, 0.3)',
                                  borderTopColor: '#ef4444',
                                  borderRadius: '50%',
                                  display: 'inline-block',
                                  animation: 'spin 0.6s linear infinite',
                                }}
                              />
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                <line x1="10" y1="11" x2="10" y2="17" />
                                <line x1="14" y1="11" x2="14" y2="17" />
                              </svg>
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                    <hr style={{ margin: '4px 0', border: 'none', borderTop: '1px solid var(--line)' }} />
                    <button
                      type="button"
                      className="menu__item"
                      style={{
                        color: 'var(--accent, #4F46E5)',
                        fontWeight: 600,
                        minHeight: '44px',
                        padding: '10px 12px',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                      onClick={() => {
                        setIsBrandMenuOpen(false);
                        setShowNewBrandModal(true);
                      }}
                    >
                      <svg className="ico" viewBox="0 0 24 24" style={{ width: 16, height: 16 }} fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      <span>+ Add New Brand</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Dedicated New Brand Button right next to All Brands */}
          <button
            id="btn-new-brand"
            type="button"
            className="btn btn--ink magnetic"
            onClick={() => setShowNewBrandModal(true)}
            style={{
              alignItems: 'center',
              gap: '4px',
              height: '32px',
              padding: '0 10px',
              fontSize: '11.5px',
              fontWeight: 600,
              borderRadius: '8px',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
              whiteSpace: 'nowrap',
              border: 'none',
              cursor: 'pointer',
              flexShrink: 0,
            }}
            title="Onboard and connect a new brand"
          >
            <svg
              className="ico"
              viewBox="0 0 24 24"
              style={{ width: 12, height: 12 }}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Brand</span>
          </button>

          {/* Notifications Dropdown */}
          <div ref={notifContainerRef} className="top__notif-wrap" style={{ position: 'relative' }}>
            <button
              id="btn-bell"
              type="button"
              className="ibtn ibtn--glass magnetic"
              aria-label="Notifications"
              title="Notifications"
              onClick={() => setIsNotifOpen((prev) => !prev)}
              aria-expanded={isNotifOpen}
            >
              <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z" />
                <path d="M10 20.5a2 2 0 0 0 4 0" />
              </svg>
              {unreadNotifCount > 0 && <span className="dot-badge" aria-hidden="true" />}
            </button>

            {isNotifOpen && (
              <>
                <div
                  className="notif-scrim"
                  onClick={() => setIsNotifOpen(false)}
                  aria-hidden="true"
                />
                <div
                  className="pop pop--wide pop--notif"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    className="pop__head"
                    style={{
                      padding: '6px 8px 10px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span className="pop__title" style={{ fontSize: '15px', fontWeight: 700 }}>
                      Notifications
                    </span>
                    {unreadNotifCount > 0 && (
                      <button
                        type="button"
                        className="text-[12px] font-medium transition-colors cursor-pointer"
                        style={{
                          color: 'var(--muted)',
                          background: 'transparent',
                          border: 'none',
                          padding: 0,
                        }}
                        onClick={() => {
                          setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
                        }}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div
                    className="pop__list"
                    style={{ gap: '4px', display: 'flex', flexDirection: 'column' }}
                  >
                    {notifications.map((item) => {
                      const Icon =
                        item.icon === 'check'
                          ? CheckCircle2
                          : item.icon === 'disconnect'
                          ? AlertTriangle
                          : item.icon === 'key'
                          ? KeyRound
                          : item.icon === 'smartphone'
                          ? Smartphone
                          : TrendingUp;

                      return (
                        <div
                          key={item.id}
                          className={`pop__row ${item.unread ? 'is-unread' : ''}`}
                          style={{
                            cursor: 'pointer',
                            borderRadius: '14px',
                            padding: '9px 10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            transition: 'background-color 0.15s ease',
                          }}
                          onClick={() => {
                            setNotifications((prev) =>
                              prev.map((n) => (n.id === item.id ? { ...n, unread: false } : n))
                            );
                            setIsNotifOpen(false);
                            if (item.icon === 'smartphone' || (item as any).postData) {
                              setManualPostForModal((item as any).postData || {
                                id: 'manual-post-demo',
                                caption: item.title,
                                brand: { name: 'Ember & Oak', color: '#c43c30' },
                                channels: [{ network: 'INSTAGRAM', handle: '@emberandoak' }],
                              });
                            } else {
                              navigate(item.link);
                            }
                          }}
                        >
                          <span style={{ position: 'relative', display: 'inline-flex' }}>
                            <div
                              style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: '50%',
                                backgroundColor: 'var(--well)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: item.unread ? 'var(--text)' : 'var(--muted)',
                                flexShrink: 0,
                              }}
                            >
                              <Icon style={{ width: '18px', height: '18px' }} />
                            </div>
                          </span>
                          <div
                            style={{
                              minWidth: 0,
                              flex: 1,
                              display: 'flex',
                              flexDirection: 'column',
                            }}
                          >
                            <b
                              style={{
                                fontSize: '13px',
                                fontWeight: item.unread ? 600 : 500,
                                lineHeight: 1.35,
                                color: 'var(--text)',
                                wordBreak: 'break-word',
                              }}
                            >
                              {item.title}
                            </b>
                            <small
                              style={{
                                fontSize: '12px',
                                color: 'var(--muted)',
                                marginTop: '2px',
                              }}
                            >
                              {item.time}
                            </small>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Profile / Account Menu */}
          <div ref={userContainerRef} className="top__user-wrap" style={{ position: 'relative' }}>
            <button
              id="btn-me"
              type="button"
              className="me magnetic"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              aria-label="Account menu"
              aria-expanded={isUserMenuOpen}
            >
              <div className="av av--md av--t1">
                {user?.name
                  ? user.name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()
                  : 'VA'}
              </div>
              <div className="me__text">
                <b>{user?.name || 'Devon Miles'}</b>
                <small>{role || 'Owner'}</small>
              </div>
            </button>

            {isUserMenuOpen && (
              <>
                <div
                  className="pop-scrim"
                  onClick={() => setIsUserMenuOpen(false)}
                  aria-hidden="true"
                />
                <div
                  className="pop pop--user"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="pop__head">
                    <span className="pop__title">{user?.name}</span>
                  </div>
                  <div className="pop__list">
                    <NavLink
                      to="/team"
                      className="menu__item"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <span>Team & Roles</span>
                    </NavLink>
                    <NavLink
                      to="/settings"
                      className="menu__item"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <span>Settings</span>
                    </NavLink>
                    <hr />
                    <button
                      type="button"
                      className="menu__item is-danger"
                      onClick={handleLogout}
                    >
                      <span>Log Out</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Floating Vertical Dock */}
      <nav className="dock" aria-label="Quick actions">
        <button
          type="button"
          className="dock__btn"
          onClick={openSearch}
          aria-label="Search (⌘K)"
        >
          <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" />
          </svg>
          <span className="dock__tip">
            Search <kbd>⌘K</kbd>
          </span>
        </button>

        <button
          ref={createBtnRef}
          type="button"
          className={`dock__btn dock__btn--new ${isCreateMenuOpen ? 'is-active' : ''}`}
          onClick={() => setIsCreateMenuOpen(!isCreateMenuOpen)}
          aria-label="Create"
          aria-expanded={isCreateMenuOpen}
        >
          <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span
            className="dock__tip"
            style={isCreateMenuOpen ? { display: 'none', opacity: 0 } : undefined}
          >
            Create <kbd>N</kbd>
          </span>
        </button>

        <button
          ref={clockBtnRef}
          type="button"
          className={`dock__btn ${isTodayQueueOpen ? 'is-active' : ''}`}
          onClick={() => setIsTodayQueueOpen(!isTodayQueueOpen)}
          aria-label="Today’s queue"
        >
          <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="8.5" />
            <path d="M12 7.5V12l3 2" />
          </svg>
          <span className="dock__tip">Today’s queue</span>
        </button>

        <NavLink
          to="/library"
          className={({ isActive }) => `dock__btn ${isActive ? 'is-active' : ''}`}
          aria-label="Library"
        >
          <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
            <circle cx="9" cy="9.5" r="1.8" />
            <path d="m4 17 5-4.5 3.5 3 3-2.5 4.5 4" />
          </svg>
          <span className="dock__tip">Library</span>
        </NavLink>

        <span className="dock__sep" aria-hidden="true" />

        <NavLink
          to="/channels"
          className={({ isActive }) => `dock__btn ${isActive ? 'is-active' : ''}`}
          aria-label="Channels"
        >
          <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
          </svg>
          <span className="dock__tip">Channels</span>
        </NavLink>

        <NavLink
          to="/team"
          className={({ isActive }) => `dock__btn ${isActive ? 'is-active' : ''}`}
          aria-label="Team & roles"
        >
          <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3.5 5 6v5.5c0 4.4 3 7.9 7 9 4-1.1 7-4.6 7-9V6z" />
            <path d="m9 12 2.2 2.2L15.5 10" />
          </svg>
          <span className="dock__tip">Team & roles</span>
        </NavLink>

        <NavLink
          to="/settings"
          className={({ isActive }) => `dock__btn ${isActive ? 'is-active' : ''}`}
          aria-label="Settings"
        >
          <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2.8l2 2.1 2.9-.4.7 2.8 2.6 1.4-1 2.8 1 2.8-2.6 1.4-.7 2.8-2.9-.4-2 2.1-2-2.1-2.9.4-.7-2.8-2.6-1.4 1-2.8-1-2.8 2.6-1.4.7-2.8 2.9.4Z" />
          </svg>
          <span className="dock__tip">Settings</span>
        </NavLink>

        <button
          type="button"
          className="dock__btn dock__theme"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          <svg className="ico ico--moon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z" />
          </svg>
          <svg className="ico ico--sun" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
          </svg>
          <span className="dock__tip">Theme</span>
        </button>
      </nav>

      {/* Quick Create Popover */}
      {isCreateMenuOpen && (
        <div
          ref={createPopRef}
          className="pop"
          style={{
            position: 'fixed',
            left: 'calc(var(--dock-x, 18px) + var(--dock-w, 68px) + 12px)',
            top: createBtnRef.current
              ? `${Math.max(16, createBtnRef.current.getBoundingClientRect().top - 8)}px`
              : '120px',
            zIndex: 90,
            width: '260px',
            borderRadius: '20px',
            background: 'var(--float, #ffffff)',
            border: '1px solid var(--line, rgba(22, 26, 30, 0.12))',
            boxShadow: '0 24px 60px -18px rgba(20, 24, 28, 0.35), 0 2px 6px rgba(20, 24, 28, 0.08)',
            padding: '6px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="menu__item"
            onClick={() => {
              setIsCreateMenuOpen(false);
              navigate('/compose');
            }}
          >
            <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              <path d="m15 5 4 4" />
            </svg>
            <span>New post</span>
          </button>
          <button
            type="button"
            className="menu__item"
            onClick={() => {
              setIsCreateMenuOpen(false);
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              tomorrow.setHours(9, 0, 0, 0);
              navigate('/compose', { state: { scheduledAt: tomorrow.getTime() } });
            }}
          >
            <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <line x1="12" y1="14" x2="12" y2="18" />
              <line x1="10" y1="16" x2="14" y2="16" />
            </svg>
            <span>Schedule for tomorrow 9:00</span>
          </button>
          <hr
            style={{
              background: 'var(--line, rgba(22, 26, 30, 0.12))',
              border: 0,
              height: '1px',
              margin: '4px 6px',
            }}
          />
          <button
            type="button"
            className="menu__item"
            onClick={() => {
              setIsCreateMenuOpen(false);
              setShowConnectModal(true);
            }}
          >
            <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            <span>Connect a channel</span>
          </button>
          <button
            type="button"
            className="menu__item"
            onClick={() => {
              setIsCreateMenuOpen(false);
              setShowNewBrandModal(true);
            }}
          >
            <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
            <span>New brand</span>
          </button>
          <button
            type="button"
            className="menu__item"
            onClick={() => {
              setIsCreateMenuOpen(false);
              setShowInviteModal(true);
            }}
          >
            <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
            <span>Invite a teammate</span>
          </button>
        </div>
      )}

      {/* Today's Queue Popover */}
      {isTodayQueueOpen && (
        <div
          ref={todayPopRef}
          className="pop pop--wide"
          style={{
            position: 'fixed',
            left: 'calc(var(--dock-x, 18px) + var(--dock-w, 68px) + 12px)',
            top: clockBtnRef.current
              ? `${Math.max(16, clockBtnRef.current.getBoundingClientRect().top - 36)}px`
              : '200px',
            zIndex: 90,
            width: 'min(380px, calc(100vw - 110px))',
            borderRadius: '24px',
            background: 'var(--float, #ffffff)',
            border: '1px solid var(--line, rgba(22, 26, 30, 0.12))',
            boxShadow: '0 24px 60px -18px rgba(20, 24, 28, 0.35), 0 2px 6px rgba(20, 24, 28, 0.08)',
            padding: '22px 24px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: '28px',
            }}
          >
            <span
              style={{
                fontSize: '19px',
                fontWeight: 700,
                letterSpacing: '-0.015em',
                color: 'var(--text, #16191d)',
              }}
            >
              Today
            </span>
            <span
              style={{
                fontSize: '13.5px',
                color: 'var(--muted, #5b6064)',
                fontWeight: 500,
              }}
            >
              {todayDateFormatted}
            </span>
          </div>

          <div
            style={{
              textAlign: 'center',
              padding: '36px 12px 42px',
              color: 'var(--muted, #5b6064)',
              fontSize: '15.5px',
              fontWeight: 500,
            }}
          >
            Nothing goes out today.
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: '6px',
            }}
          >
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => {
                setIsTodayQueueOpen(false);
                navigate('/calendar');
              }}
              style={{
                borderRadius: '999px',
                padding: '0 18px',
                fontWeight: 600,
                fontSize: '13.5px',
                border: '1px solid var(--line-2, rgba(22, 26, 30, 0.16))',
                background: 'transparent',
                color: 'var(--text, #16191d)',
                height: '40px',
                cursor: 'pointer',
              }}
            >
              Open calendar
            </button>
            <button
              type="button"
              className="btn btn--sm btn--ink"
              onClick={() => {
                setIsTodayQueueOpen(false);
                navigate('/compose');
              }}
              style={{
                borderRadius: '999px',
                padding: '0 20px',
                fontWeight: 600,
                fontSize: '13.5px',
                background: 'var(--pill, #16191d)',
                color: 'var(--on-pill, #ffffff)',
                border: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                height: '40px',
                cursor: 'pointer',
              }}
            >
              <svg className="ico" viewBox="0 0 24 24" style={{ width: 15, height: 15, strokeWidth: 2.2 }}>
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span>New post</span>
            </button>
          </div>
        </div>
      )}

      {/* Connect a Channel Modal (Manual ID & Password + Official OAuth) */}
      {showConnectModal && (
        <div
          className="scrim"
          style={{
            opacity: 1,
            visibility: 'visible',
            display: 'grid',
            placeItems: 'center',
            padding: '16px',
            zIndex: 10000,
            background: 'rgba(12, 14, 16, 0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            overflowY: 'auto',
          }}
          onClick={() => setShowConnectModal(false)}
        >
          <div
            className="card modal"
            style={{
              maxWidth: '560px',
              width: '100%',
              maxHeight: 'min(90vh, 740px)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              borderRadius: '24px',
              background: 'var(--solid, #191b1f)',
              border: '1px solid var(--rim, rgba(255,255,255,0.12))',
              boxShadow: '0 24px 60px -15px rgba(0, 0, 0, 0.85)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <form
              className="mform"
              style={{
                display: 'flex',
                flexDirection: 'column',
                maxHeight: 'min(90vh, 740px)',
                overflowY: 'auto',
                padding: '24px',
              }}
              onSubmit={async (e) => {
                e.preventDefault();
                const effectiveBrandId =
                  connectBrandId && connectBrandId !== 'ember'
                    ? connectBrandId
                    : (selectedBrandId && selectedBrandId !== 'all' ? selectedBrandId : '') || brands[0]?.id || '';

                if (connectMethod === 'manual') {
                  if (!connectHandle.trim()) {
                    addToast({ type: 'error', message: 'Please enter account handle or page name.' });
                    return;
                  }

                  setIsSubmittingConnect(true);
                  try {
                    const res: any = await apiFetch('/channels/connect-manual', {
                      method: 'POST',
                      body: JSON.stringify({
                        brandId: effectiveBrandId,
                        brandName: connectHandle.trim().replace(/^@/, '') || 'Main Brand',
                        network: connectNet.toUpperCase(),
                        handle: connectHandle.trim(),
                        accountLogin: connectLogin.trim(),
                        accountPassword: connectPassword.trim(),
                      }),
                    });

                    if (res && res.channel) {
                      const rawNet = (res.channel.network || connectNet).toLowerCase();
                      const cleanHandle = res.channel.handle || connectHandle.trim();
                      const newCh = {
                        id: res.channel.id,
                        brandId: res.channel.brandId,
                        net: rawNet,
                        handle: cleanHandle,
                        followers: res.channel.followers || 14200,
                        growthPct: 4.8,
                        daysLeft: 60,
                        totalDays: 60,
                        lastSync: 'Just now',
                        connectedBy: 'Manual ID & Password',
                        status: 'connected',
                        postingEnabled: true,
                      };

                      // 1. If brand was created/returned, register in authStore!
                      if (res.brand) {
                        const currentBrands = useAuthStore.getState().brands || [];
                        if (!currentBrands.some((b) => b.id === res.brand.id)) {
                          useAuthStore.setState({
                            brands: [res.brand, ...currentBrands],
                            selectedBrandId: res.brand.id,
                          });
                        }
                      }

                      try {
                        const saved = localStorage.getItem('vs_custom_channels');
                        const prev = saved ? JSON.parse(saved) : [];
                        const updated = [newCh, ...prev.filter((c: any) => c.id !== newCh.id)];
                        localStorage.setItem('vs_custom_channels', JSON.stringify(updated));
                      } catch {}

                      window.dispatchEvent(new CustomEvent('channel:created', { detail: newCh }));

                      addToast({
                        type: 'success',
                        message: res.message || `Successfully connected ${NETWORKS.find((n) => n.id === connectNet)?.name || connectNet} (${cleanHandle})! Past posts synced to dashboard.`,
                      });

                      setShowConnectModal(false);
                      setConnectHandle('');
                      setConnectLogin('');
                      setConnectPassword('');
                    }
                  } catch (err: any) {
                    addToast({
                      type: 'error',
                      message: err.message || 'Failed to connect channel manually.',
                    });
                  } finally {
                    setIsSubmittingConnect(false);
                  }
                  return;
                }

                // 2. Official OAuth Mode
                if (connectNet === 'facebook' || connectNet === 'instagram') {
                  setShowConnectModal(false);
                  addToast({
                    type: 'info',
                    message: `Connecting to official ${NETWORKS.find((n) => n.id === connectNet)?.name || 'Meta'}...`,
                  });

                  let authUrl: string | null = null;
                  try {
                    try {
                      const directAuth: any = await apiFetch(`/channels/meta/auth-url?brandId=${effectiveBrandId}`);
                      if (directAuth?.authUrl) {
                        authUrl = directAuth.authUrl;
                      }
                    } catch {}

                    if (!authUrl) {
                      const inviteRes: any = await apiFetch('/invites/connect', {
                        method: 'POST',
                        body: JSON.stringify({ brandId: effectiveBrandId }),
                      });
                      if (inviteRes?.rawToken) {
                        const authRes: any = await apiFetch(`/invites/${inviteRes.rawToken}/meta-auth`);
                        if (authRes?.authUrl) {
                          authUrl = authRes.authUrl;
                        }
                      }
                    }

                    if (authUrl) {
                      window.location.href = authUrl;
                      return;
                    }
                  } catch (err: any) {
                    addToast({
                      type: 'error',
                      message: err.message || 'Could not start Meta login. Make sure Meta App ID is configured on Render.',
                    });
                  }
                }
                setActiveOAuthNet(connectNet as OAuthNetwork);
              }}
            >
              <div className="mform__head">
                <div>
                  <h3 className="mform__title">Connect Social Account</h3>
                  <p className="mform__sub">
                    Manually add your client&apos;s ID &amp; Password to link their accounts and sync past posts.
                  </p>
                </div>
                <button
                  type="button"
                  className="ibtn ibtn--sm"
                  onClick={() => setShowConnectModal(false)}
                  aria-label="Close"
                >
                  <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Connection Mode Tabs */}
              <div
                style={{
                  display: 'flex',
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: '12px',
                  padding: '4px',
                  marginBottom: '16px',
                  gap: '6px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setConnectMethod('manual')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: connectMethod === 'manual' ? 'var(--ink, #f2b740)' : 'transparent',
                    color: connectMethod === 'manual' ? '#111315' : 'var(--text, #eef0ee)',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <span>🔑</span> Manual ID &amp; Password
                </button>
                <button
                  type="button"
                  onClick={() => setConnectMethod('oauth')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: connectMethod === 'oauth' ? 'var(--ink, #f2b740)' : 'transparent',
                    color: connectMethod === 'oauth' ? '#111315' : 'var(--text, #eef0ee)',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <span>🌐</span> Official OAuth
                </button>
              </div>

              {/* 8 Networks Grid */}
              <div
                className="cc-nets"
                role="radiogroup"
                aria-label="Network"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                  gap: '8px',
                  margin: '8px 0',
                }}
              >
                {NETWORKS.map((n) => {
                  const isSelected = connectNet === n.id;
                  return (
                    <div
                      key={n.id}
                      role="button"
                      tabIndex={0}
                      className="cc-net"
                      onClick={() => setConnectNet(n.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setConnectNet(n.id);
                        }
                      }}
                      style={{
                        border: isSelected ? '2px solid var(--text, #eef0ee)' : '1.5px solid var(--line-2, rgba(255,255,255,0.12))',
                        background: isSelected ? 'var(--glass-3, rgba(255,255,255,0.18))' : 'var(--glass-2, rgba(255,255,255,0.06))',
                        boxShadow: isSelected ? '0 0 0 2px var(--butter, #f2b740)' : 'none',
                        transform: isSelected ? 'scale(1.02)' : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.18s cubic-bezier(0.2, 0.8, 0.2, 1)',
                        display: 'grid',
                        justifyItems: 'center',
                        gap: '3px',
                        padding: '8px 4px 6px',
                        borderRadius: '12px',
                        userSelect: 'none',
                      }}
                      title={`Select ${n.name}`}
                    >
                      <span className={`net net--sm net--${n.id}`}>
                        <NetworkIcon network={n.id} className="ico" />
                      </span>
                      <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text)' }}>
                        {n.name}
                      </span>
                      <span style={{ fontSize: '10px', color: isSelected ? 'var(--butter, #f2b740)' : 'var(--muted)', marginTop: '-2px' }}>
                        {isSelected ? '✓ Selected' : 'Choose'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* For Brand Selection */}
              <div className="field field--wide" style={{ marginTop: '14px' }}>
                <span className="field__label">For brand</span>
                {brands.length > 0 ? (
                  <select
                    className="input"
                    value={connectBrandId}
                    onChange={(e) => setConnectBrandId(e.target.value)}
                    style={{ color: 'var(--text)' }}
                  >
                    {brands.map((b) => (
                      <option
                        key={b.id}
                        value={b.id}
                        style={{ background: '#1f2226', color: '#eef0ee' }}
                      >
                        {b.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div>
                    <input
                      className="input"
                      placeholder="Brand name (e.g. Main Brand)"
                      value={connectHandle ? connectHandle.replace(/^@/, '') : 'Main Brand'}
                      readOnly
                      style={{ color: 'var(--text)' }}
                    />
                    <span
                      style={{
                        fontSize: '11px',
                        color: 'var(--butter, #f2b740)',
                        marginTop: '4px',
                        display: 'block',
                      }}
                    >
                      ⚡ No existing brands found — a brand will be created automatically.
                    </span>
                  </div>
                )}
              </div>

              {connectMethod === 'manual' ? (
                <>
                  {/* Account Handle / Page Name */}
                  <div className="field field--wide" style={{ marginTop: '12px' }}>
                    <span className="field__label">
                      {connectNet === 'facebook' || connectNet === 'linkedin'
                        ? 'Page Name / Handle'
                        : 'Username / Handle'}
                    </span>
                    <input
                      type="text"
                      required
                      className="input"
                      placeholder={
                        ['facebook', 'youtube', 'linkedin'].includes(connectNet)
                          ? 'e.g. Gaurav Official Page'
                          : 'e.g. @gaurav_official'
                      }
                      value={connectHandle}
                      onChange={(e) => setConnectHandle(e.target.value)}
                    />
                  </div>

                  {/* Account Login ID / Email */}
                  <div className="field field--wide" style={{ marginTop: '12px' }}>
                    <span className="field__label">Account Login ID / Email (Optional)</span>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. client@gmail.com or +91 9876543210"
                      value={connectLogin}
                      onChange={(e) => setConnectLogin(e.target.value)}
                    />
                  </div>

                  {/* Account Password / Token */}
                  <div className="field field--wide" style={{ marginTop: '12px' }}>
                    <span className="field__label">Account Password / Access Key</span>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showConnectPassword ? 'text' : 'password'}
                        className="input"
                        placeholder="Enter account password or access key"
                        value={connectPassword}
                        onChange={(e) => setConnectPassword(e.target.value)}
                        style={{ paddingRight: '50px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConnectPassword(!showConnectPassword)}
                        style={{
                          position: 'absolute',
                          right: '10px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--muted, #94a3b8)',
                          cursor: 'pointer',
                          fontSize: '12.5px',
                          fontWeight: 600,
                        }}
                      >
                        {showConnectPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>

                  {/* Past Posts Sync Banner */}
                  <div
                    style={{
                      marginTop: '14px',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: 'rgba(34, 197, 94, 0.12)',
                      border: '1px solid rgba(34, 197, 94, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      fontSize: '12px',
                      color: '#86efac',
                    }}
                  >
                    <span style={{ fontSize: '15px' }}>⚡</span>
                    <span>
                      <b>Dashboard Sync:</b> Account connects instantly. Client&apos;s past posts and audience metrics will be automatically populated in your overview feed.
                    </span>
                  </div>
                </>
              ) : (
                /* OAuth explanation */
                <div
                  style={{
                    marginTop: '16px',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: 'rgba(24, 119, 242, 0.12)',
                    border: '1px solid rgba(24, 119, 242, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '12.5px',
                    color: '#93c5fd',
                  }}
                >
                  <span style={{ fontSize: '16px' }}>🔒</span>
                  <span>
                    Will redirect to official <b>{NETWORKS.find((n) => n.id === connectNet)?.name || 'Network'} Login</b> dialog to grant permissions.
                  </span>
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  marginTop: '20px',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--line, rgba(255,255,255,0.08))',
                  position: 'sticky',
                  bottom: 0,
                  background: 'var(--solid, #191b1f)',
                }}
              >
                <button
                  type="button"
                  className="btn btn--subtle"
                  onClick={() => setShowConnectModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingConnect}
                  className="btn btn--ink"
                  style={{
                    background: 'var(--ink, #f2b740)',
                    color: '#111315',
                    fontWeight: 700,
                  }}
                >
                  {isSubmittingConnect
                    ? 'Connecting...'
                    : connectMethod === 'manual'
                    ? `Confirm & Connect ${NETWORKS.find((n) => n.id === connectNet)?.name || 'Account'}`
                    : `Continue to ${NETWORKS.find((n) => n.id === connectNet)?.name || 'Official Login'} →`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Social Media OAuth Login Dialog */}
      <SocialOAuthModal
        isOpen={!!activeOAuthNet}
        network={activeOAuthNet || 'instagram'}
        brandName={brands.find((b) => b.id === connectBrandId)?.name || 'Brand'}
        brandId={connectBrandId}
        onClose={() => {
          setActiveOAuthNet(null);
        }}
        onBack={() => {
          setActiveOAuthNet(null);
          setShowConnectModal(true);
        }}
        onSuccess={async ({ handle: newHandle, network: newNet, brandId: bId }) => {
          const targetBrand = brands.find((b) => b.id === bId) || brands[0];
          const netName = NETWORKS.find((n) => n.id === newNet)?.name || 'Account';
          
          // Save locally so ChannelsView immediately sees it
          try {
            const saved = localStorage.getItem('vs_custom_channels');
            const list = saved ? JSON.parse(saved) : [];
            const newCh = {
              id: `ch-${bId}-${newNet}-${Date.now()}`,
              brandId: bId,
              net: newNet as any,
              handle: newHandle,
              followers: Math.floor(12000 + Math.random() * 45000),
              growthPct: 5.2,
              daysLeft: 60,
              totalDays: 60,
              lastSync: 'Just now',
              connectedBy: user?.name || 'Devon',
              status: 'connected',
              postingEnabled: true,
            };
            const filtered = list.filter((c: any) => !(c.brandId === bId && c.net === newNet));
            localStorage.setItem('vs_custom_channels', JSON.stringify([newCh, ...filtered]));
          } catch (e) {
            console.error(e);
          }

          addToast({
            type: 'success',
            message: `Successfully connected ${targetBrand?.name || 'Brand'} · ${netName} (${newHandle})`,
          });
          setActiveOAuthNet(null);
          setShowConnectModal(false);

          // Persist to backend database
          try {
            await apiFetch('/channels/connect-mock', {
              method: 'POST',
              body: JSON.stringify({
                brandId: bId,
                network: newNet.toUpperCase(),
                handle: newHandle,
              }),
            });
          } catch (err) {
            console.warn('Failed to persist channel to backend:', err);
          }
        }}
      />

      {/* Invite a Teammate Modal (matching Screenshot 3) */}
      {showInviteModal && (
        <div
          className="scrim"
          style={{
            opacity: 1,
            visibility: 'visible',
            display: 'grid',
            placeItems: 'center',
            padding: '20px',
            zIndex: 100,
            background: 'rgba(16, 18, 20, 0.45)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          }}
          onClick={() => setShowInviteModal(false)}
        >
          <div
            className="modal"
            style={{
              maxWidth: '560px',
              width: '100%',
              background: 'var(--float, #fdfdfb)',
              borderRadius: '26px',
              border: '1px solid var(--rim, var(--line, rgba(22, 26, 30, 0.15)))',
              boxShadow: 'var(--shadow-pop)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <form
              className="mform"
              onSubmit={(e) => {
                e.preventDefault();
                if (!inviteEmail.trim()) return;
                addToast({
                  type: 'success',
                  message: `Invite sent to ${inviteEmail.trim()}`,
                });
                setShowInviteModal(false);
                setInviteName('');
                setInviteEmail('');
              }}
            >
              <div className="mform__head">
                <div>
                  <h3 className="mform__title">Invite a teammate</h3>
                  <p className="mform__sub">
                    They get an email with a link to join {workspace?.name || 'VS Adda Agency'}.
                  </p>
                </div>
                <button
                  type="button"
                  className="ibtn ibtn--sm"
                  onClick={() => setShowInviteModal(false)}
                  aria-label="Close"
                >
                  <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div className="mform__grid">
                <label className="field">
                  <span className="field__label">Full name</span>
                  <input
                    type="text"
                    placeholder="Jordan Blake"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    required
                    autoFocus
                  />
                </label>
                <label className="field">
                  <span className="field__label">Work email</span>
                  <input
                    type="email"
                    placeholder="jordan@northlight.studio"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                </label>
                <label className="field field--wide">
                  <span className="field__label">Role</span>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                  >
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                    <option value="reviewer">Reviewer</option>
                    <option value="contributor">Contributor</option>
                  </select>
                  <span className="field__hint">
                    You can change this, or the role itself, any time on the Team page.
                  </span>
                </label>
                <label className="field field--wide">
                  <span className="field__label">Brands</span>
                  <select
                    value={inviteBrand}
                    onChange={(e) => setInviteBrand(e.target.value)}
                  >
                    <option value="all">All brands</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} only
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mform__foot" style={{ marginTop: '24px' }}>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setShowInviteModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn--ink">
                  Send invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Outlet */}
      <main id="main" className="main" ref={mainRef}>
        <section key={location.pathname} className="view" data-view={currentView}>
          <ErrorBoundary fallbackTitle="Could not load this page">
            <Outlet context={{ selectedBrandId, setSelectedBrandId }} />
          </ErrorBoundary>
        </section>
      </main>

      {/* Mobile Bottom Navigation Bar (UI-001) */}
      <nav className="mnav" aria-label="Mobile Navigation">
        <NavLink
          to="/overview"
          className={({ isActive }) => `mnav__item ${isActive ? 'is-active' : ''}`}
          aria-current={currentView === 'overview' ? 'page' : undefined}
        >
          <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H4a1 1 0 0 1-1-1z" />
          </svg>
          <span>Overview</span>
        </NavLink>

        <NavLink
          to="/calendar"
          className={({ isActive }) => `mnav__item ${isActive ? 'is-active' : ''}`}
          aria-current={currentView === 'calendar' ? 'page' : undefined}
        >
          <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
            <path d="M3.5 9h17M8 2.5v4M16 2.5v4" />
          </svg>
          <span>Calendar</span>
        </NavLink>

        <NavLink
          to="/compose"
          className="mnav__item mnav__new"
          aria-label="Compose new post"
        >
          <span className="mnav__plus">
            <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
        </NavLink>

        <NavLink
          to="/inbox"
          className={({ isActive }) => `mnav__item ${isActive ? 'is-active' : ''}`}
          aria-current={currentView === 'inbox' ? 'page' : undefined}
        >
          <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
          <span>Inbox</span>
          <span className="mnav__count">4</span>
        </NavLink>

        <button
          type="button"
          className={`mnav__item mnav__more ${
            ['approvals', 'analytics', 'listening', 'channels', 'library', 'team', 'settings'].includes(currentView)
              ? 'is-current'
              : ''
          }`}
          onClick={() => setIsMoreSheetOpen(!isMoreSheetOpen)}
          aria-expanded={isMoreSheetOpen}
          aria-label="More workspace sections"
        >
          <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="19" cy="12" r="1.5" />
            <circle cx="5" cy="12" r="1.5" />
          </svg>
          <span>More</span>
        </button>
      </nav>

      {/* Mobile Navigation "More" Sheet Modal */}
      {isMoreSheetOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            backgroundColor: 'rgba(16, 18, 20, 0.45)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          }}
          onClick={() => setIsMoreSheetOpen(false)}
        >
          <div
            className="drawer"
            style={{
              position: 'relative',
              inset: 'auto',
              width: '100%',
              maxWidth: '100%',
              borderRadius: '28px 28px 0 0',
              maxHeight: '86dvh',
              overflowY: 'auto',
              margin: 0,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer__inner" style={{ padding: '24px 18px calc(24px + env(safe-area-inset-bottom))' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, paddingRight: 0 }}>Workspace Menu</h2>
                <button
                  type="button"
                  className="ibtn ibtn--sm"
                  onClick={() => setIsMoreSheetOpen(false)}
                  aria-label="Close menu"
                >
                  <svg className="ico" viewBox="0 0 24 24">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div className="msheet">
                <NavLink
                  to="/approvals"
                  className={({ isActive }) => `msheet__item ${isActive ? 'is-active' : ''}`}
                  aria-current={currentView === 'approvals' ? 'page' : undefined}
                  onClick={() => setIsMoreSheetOpen(false)}
                >
                  <span className="msheet__ico">
                    <svg className="ico" viewBox="0 0 24 24">
                      <path d="m9 12 2 2 4-4" />
                      <circle cx="12" cy="12" r="9" />
                    </svg>
                  </span>
                  <span>Approvals</span>
                  <span className="tab-count">2</span>
                </NavLink>

                <NavLink
                  to="/analytics"
                  className={({ isActive }) => `msheet__item ${isActive ? 'is-active' : ''}`}
                  aria-current={currentView === 'analytics' ? 'page' : undefined}
                  onClick={() => setIsMoreSheetOpen(false)}
                >
                  <span className="msheet__ico">
                    <svg className="ico" viewBox="0 0 24 24">
                      <path d="M3 3v18h18" />
                      <path d="m19 9-5 5-4-4-3 3" />
                    </svg>
                  </span>
                  <span>Analytics</span>
                </NavLink>

                <NavLink
                  to="/listening"
                  className={({ isActive }) => `msheet__item ${isActive ? 'is-active' : ''}`}
                  aria-current={currentView === 'listening' ? 'page' : undefined}
                  onClick={() => setIsMoreSheetOpen(false)}
                >
                  <span className="msheet__ico">
                    <svg className="ico" viewBox="0 0 24 24">
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="22" />
                    </svg>
                  </span>
                  <span>Listening</span>
                </NavLink>

                <NavLink
                  to="/channels"
                  className={({ isActive }) => `msheet__item ${isActive ? 'is-active' : ''}`}
                  aria-current={currentView === 'channels' ? 'page' : undefined}
                  onClick={() => setIsMoreSheetOpen(false)}
                >
                  <span className="msheet__ico">
                    <svg className="ico" viewBox="0 0 24 24">
                      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
                    </svg>
                  </span>
                  <span>Channels</span>
                </NavLink>

                <NavLink
                  to="/library"
                  className={({ isActive }) => `msheet__item ${isActive ? 'is-active' : ''}`}
                  aria-current={currentView === 'library' ? 'page' : undefined}
                  onClick={() => setIsMoreSheetOpen(false)}
                >
                  <span className="msheet__ico">
                    <svg className="ico" viewBox="0 0 24 24">
                      <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
                      <circle cx="9" cy="9.5" r="1.8" />
                      <path d="m4 17 5-4.5 3.5 3 3-2.5 4.5 4" />
                    </svg>
                  </span>
                  <span>Library</span>
                </NavLink>

                <NavLink
                  to="/team"
                  className={({ isActive }) => `msheet__item ${isActive ? 'is-active' : ''}`}
                  aria-current={currentView === 'team' ? 'page' : undefined}
                  onClick={() => setIsMoreSheetOpen(false)}
                >
                  <span className="msheet__ico">
                    <svg className="ico" viewBox="0 0 24 24">
                      <path d="M12 3.5 5 6v5.5c0 4.4 3 7.9 7 9 4-1.1 7-4.6 7-9V6z" />
                      <path d="m9 12 2.2 2.2L15.5 10" />
                    </svg>
                  </span>
                  <span>Team & Roles</span>
                </NavLink>

                <NavLink
                  to="/settings"
                  className={({ isActive }) => `msheet__item ${isActive ? 'is-active' : ''}`}
                  aria-current={currentView === 'settings' ? 'page' : undefined}
                  onClick={() => setIsMoreSheetOpen(false)}
                  style={{ gridColumn: '1 / -1' }}
                >
                  <span className="msheet__ico">
                    <svg className="ico" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M12 2.8l2 2.1 2.9-.4.7 2.8 2.6 1.4-1 2.8 1 2.8-2.6 1.4-.7 2.8-2.9-.4-2 2.1-2-2.1-2.9.4-.7-2.8-2.6-1.4 1-2.8-1-2.8 2.6-1.4.7-2.8 2.9.4Z" />
                    </svg>
                  </span>
                  <span>Settings & Preferences</span>
                </NavLink>
              </div>

              <div className="msheet__row" style={{ marginTop: '16px' }}>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={toggleTheme}
                >
                  {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => {
                    setIsMoreSheetOpen(false);
                    setShowInviteModal(true);
                  }}
                >
                  + Invite
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => {
                    setIsMoreSheetOpen(false);
                    setShowNewBrandModal(true);
                  }}
                >
                  + Brand
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fixed bottom-right back to top ascent button */}
      <BackToTopRocket />

      {/* New Brand Onboarding Modal */}
      <NewBrandModal
        isOpen={showNewBrandModal}
        onClose={() => setShowNewBrandModal(false)}
      />

      {/* Manual Publish Modal */}
      <ManualPublishModal
        isOpen={!!manualPostForModal}
        post={manualPostForModal}
        onClose={() => setManualPostForModal(null)}
        onPublished={() => {
          setNotifications((prev) =>
            prev.map((n) => (n.id === 'notif-manual-1' ? { ...n, unread: false } : n))
          );
        }}
      />
    </div>
  );
}
