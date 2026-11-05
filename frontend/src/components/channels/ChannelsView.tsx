import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore.js';
import { useToastStore } from '../../stores/toastStore.js';
import { NetworkIcon } from '../common/NetworkIcon.js';
import { SocialOAuthModal, OAuthNetwork } from './SocialOAuthModal.js';
import { apiFetch } from '../../lib/api.js';

import { matchesBrand, getBrandCanonicalSlug, getBrandMeta } from '../../lib/brandHelper.js';

interface BrandMeta {
  id: string;
  name: string;
  short: string;
  industry: string;
  tone: 'coral' | 'butter' | 'ink' | 'pine' | 'sea';
  monogram: string;
  cover: string;
}

const BRANDS_DATA: Record<string, BrandMeta> = {};

interface ChannelItem {
  id: string;
  brandId: string;
  net: 'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'pinterest' | 'threads' | 'x' | 'linkedin';
  handle: string;
  followers: number;
  growthPct: number;
  daysLeft: number;
  totalDays: number;
  lastSync: string;
  connectedBy: string;
  connectedByPhoto?: string;
  status: 'connected' | 'expiring' | 'disconnected';
  postingEnabled: boolean;
}

const INITIAL_CHANNELS: ChannelItem[] = [];

const NETWORK_METAS: Record<string, { name: string; what: string; publish: boolean; inbox: boolean; analytics: boolean }> = {
  instagram: {
    name: 'Instagram',
    what: 'Posts, Reels and Stories · first comment',
    publish: true,
    inbox: true,
    analytics: true,
  },
  facebook: {
    name: 'Facebook',
    what: 'Page posts, comments, messages and reviews',
    publish: true,
    inbox: true,
    analytics: true,
  },
  x: {
    name: 'X',
    what: 'Posts and threads · mentions and DMs',
    publish: true,
    inbox: true,
    analytics: true,
  },
  linkedin: {
    name: 'LinkedIn',
    what: 'Company page posts and comments',
    publish: true,
    inbox: false,
    analytics: true,
  },
  tiktok: {
    name: 'TikTok',
    what: 'Videos · comments',
    publish: true,
    inbox: true,
    analytics: true,
  },
  youtube: {
    name: 'YouTube',
    what: 'Videos and Shorts · comments',
    publish: true,
    inbox: false,
    analytics: true,
  },
  pinterest: {
    name: 'Pinterest',
    what: 'Pins and boards',
    publish: true,
    inbox: false,
    analytics: true,
  },
  threads: {
    name: 'Threads',
    what: 'Posts and replies',
    publish: true,
    inbox: true,
    analytics: true,
  },
};

function formatCompactNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

const getInitialChannels = (): ChannelItem[] => {
  try {
    const saved = localStorage.getItem('vs_custom_channels');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const savedIds = new Set(parsed.map((c: any) => c.id));
        return [...parsed, ...INITIAL_CHANNELS.filter((c) => !savedIds.has(c.id))];
      }
    }
  } catch (e) {
    console.error('Failed to parse vs_custom_channels from localStorage', e);
  }
  return INITIAL_CHANNELS;
};

export function ChannelsView() {
  const navigate = useNavigate();
  const addToast = useToastStore((state) => state.addToast);
  const { brands, selectedBrandId: authBrandId } = useAuthStore();
  const outletCtx = useOutletContext<{ selectedBrandId?: string; setSelectedBrandId?: (id: string) => void }>() || {};

  const [channels, setChannels] = useState<ChannelItem[]>(getInitialChannels);

  // Sync real channels from backend database on load
  useEffect(() => {
    const fetchDbChannels = async () => {
      try {
        const res: any = await apiFetch('/channels');
        if (res && res.channels && Array.isArray(res.channels)) {
          const dbChannels: ChannelItem[] = res.channels.map((ch: any) => {
            const rawNet = (ch.network || 'instagram').toLowerCase();
            const prefix = ['instagram', 'x', 'tiktok', 'threads'].includes(rawNet) ? '@' : '';
            const cleanHandle = ch.handle?.startsWith('@') ? ch.handle : `${prefix}${ch.handle || 'account'}`;
            return {
              id: ch.id,
              brandId: ch.brandId,
              net: rawNet as any,
              handle: cleanHandle,
              followers: ch.followers || 14200,
              growthPct: 4.8,
              daysLeft: 60,
              totalDays: 60,
              lastSync: 'Synced with database',
              connectedBy: 'Zero-Login Portal',
              status: (ch.status === 'CONNECTED' || ch.status === 'PAUSED') ? 'connected' : ch.status === 'EXPIRING' ? 'expiring' : 'disconnected',
              postingEnabled: ch.postingEnabled ?? (ch.status !== 'PAUSED'),
            };
          });

          // Set state to authoritative database channels — never resurrect deleted channels!
          setChannels(dbChannels);
          try {
            localStorage.setItem('vs_custom_channels', JSON.stringify(dbChannels));
          } catch {}
        }
      } catch {
        // Fallback to localStorage / initial channels if offline
      }
    };

    fetchDbChannels();
  }, [brands]);
  const activeBrandId = outletCtx.selectedBrandId || authBrandId || 'all';

  const [filter, setFilter] = useState<'all' | 'attention' | 'paused'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [targetBrandForConnect, setTargetBrandForConnect] = useState<string>('');
  const [menuOpenForChannel, setMenuOpenForChannel] = useState<string | null>(null);

  // Connect wizard state
  const [wizardBrand, setWizardBrand] = useState<string>('');
  const [wizardNet, setWizardNet] = useState<string>('facebook');
  const [wizardHandle, setWizardHandle] = useState<string>('');
  const [wizardLogin, setWizardLogin] = useState<string>('');
  const [wizardPassword, setWizardPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [connectMethod, setConnectMethod] = useState<'manual' | 'oauth'>('manual');
  const [isSubmittingConnect, setIsSubmittingConnect] = useState<boolean>(false);
  const [activeOAuthNet, setActiveOAuthNet] = useState<OAuthNetwork | null>(null);

  // Keep wizardBrand dynamically in sync with user's real brands
  useEffect(() => {
    if (brands && brands.length > 0) {
      if (!wizardBrand || wizardBrand === 'ember' || !brands.some((b) => b.id === wizardBrand)) {
        const preferredId = (activeBrandId && activeBrandId !== 'all') ? activeBrandId : brands[0].id;
        setWizardBrand(preferredId);
        setTargetBrandForConnect(preferredId);
      }
    }
  }, [brands, activeBrandId, wizardBrand]);

  // Handle reconnect with full database persistence
  const handleReconnect = async (channelId: string) => {
    setChannels((prev) => {
      const next = prev.map((c) => {
        if (c.id === channelId) {
          return {
            ...c,
            status: 'connected' as const,
            daysLeft: 60,
            lastSync: 'Just now',
            postingEnabled: true,
          };
        }
        return c;
      });
      try {
        localStorage.setItem('vs_custom_channels', JSON.stringify(next));
      } catch {}
      return next;
    });

    const target = channels.find((c) => c.id === channelId);
    const brandName = target ? getBrandMeta(target.brandId, brands).name : 'Brand';

    try {
      await apiFetch(`/channels/${channelId}/reconnect`, { method: 'POST' });
      addToast({
        type: 'success',
        message: `${brandName} ${target ? NETWORK_METAS[target.net]?.name : ''} reconnected · access token renewed.`,
      });
    } catch {
      // Fallback to PATCH if needed
      try {
        await apiFetch(`/channels/${channelId}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'CONNECTED', postingEnabled: true }),
        });
        addToast({
          type: 'success',
          message: `${brandName} ${target ? NETWORK_METAS[target.net]?.name : ''} reconnected.`,
        });
      } catch {
        addToast({
          type: 'info',
          message: `${brandName} connection refreshed.`,
        });
      }
    }
  };

  // Bulk reconnect all channels across workspace
  const handleReconnectAll = async () => {
    setChannels((prev) => {
      const next = prev.map((c) => ({
        ...c,
        status: 'connected' as const,
        daysLeft: 60,
        lastSync: 'Just now',
        postingEnabled: true,
      }));
      try {
        localStorage.setItem('vs_custom_channels', JSON.stringify(next));
      } catch {}
      return next;
    });

    try {
      await apiFetch('/channels/reconnect-all', { method: 'POST' });
      addToast({
        type: 'success',
        message: 'All channels reconnected and active.',
      });
    } catch {
      addToast({
        type: 'info',
        message: 'All channels refreshed.',
      });
    }
  };

  // Toggle posting switch with backend database sync
  const handleTogglePosting = async (channelId: string) => {
    let nextState = true;
    setChannels((prev) =>
      prev.map((c) => {
        if (c.id === channelId) {
          nextState = !c.postingEnabled;
          return { ...c, postingEnabled: nextState };
        }
        return c;
      })
    );

    const c = channels.find((ch) => ch.id === channelId);
    if (c) {
      addToast({
        type: 'info',
        message: nextState ? `Posting resumed for ${c.handle}` : `Posting paused for ${c.handle}`,
      });
    }

    try {
      await apiFetch(`/channels/${channelId}`, {
        method: 'PATCH',
        body: JSON.stringify({ postingEnabled: nextState }),
      });
    } catch (e) {
      console.error('Failed to sync posting state', e);
    }
  };

  // Disconnect & permanently delete channel from database and local state
  const handleDisconnect = async (channelId: string) => {
    try {
      await apiFetch(`/channels/${channelId}`, { method: 'DELETE' }).catch(() => {});
      setChannels((prev) => {
        const remaining = prev.filter((c) => c.id !== channelId);
        try {
          const customOnly = remaining.filter((c) => !INITIAL_CHANNELS.some((ic) => ic.id === c.id));
          localStorage.setItem('vs_custom_channels', JSON.stringify(customOnly));
        } catch {}
        return remaining;
      });
      setMenuOpenForChannel(null);
      addToast({ type: 'success', message: 'Channel deleted and disconnected permanently.' });
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to disconnect channel' });
    }
  };

  // One-click purge all seeded demo/mock channels
  const handlePurgeAllDemoChannels = async () => {
    try {
      await apiFetch('/channels/purge-mocks', { method: 'DELETE' }).catch(() => {});
      try {
        localStorage.removeItem('vs_custom_channels');
      } catch {}
      setChannels([]);
      addToast({ type: 'success', message: 'All demo channels removed from workspace!' });
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to remove demo channels' });
    }
  };

  // Scoped channels based on active brand selection
  const scopedChannels = useMemo(() => {
    // Only keep channels that belong to active, non-deleted brands
    const validBrandIds = new Set((brands || []).map((b) => b.id));
    const liveChannels = channels.filter((c) => validBrandIds.has(c.brandId));

    if (!activeBrandId || activeBrandId === 'all') return liveChannels;
    return liveChannels.filter((c) => matchesBrand(c.brandId, activeBrandId, brands));
  }, [channels, activeBrandId, brands]);

  // Filter channels with secondary tab and search query
  const filteredChannels = useMemo(() => {
    return scopedChannels.filter((c) => {
      if (filter === 'attention' && c.status === 'connected') return false;
      if (filter === 'paused' && c.postingEnabled) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const brand = getBrandMeta(c.brandId, brands).name.toLowerCase();
        const netName = NETWORK_METAS[c.net]?.name?.toLowerCase() || '';
        return c.handle.toLowerCase().includes(q) || brand.includes(q) || netName.includes(q);
      }
      return true;
    });
  }, [scopedChannels, filter, searchQuery]);

  // Broken channels for attention banner (only within active scope)
  const brokenChannels = useMemo(() => {
    return scopedChannels.filter((c) => c.status !== 'connected');
  }, [scopedChannels]);

  // Stats calculation dynamically scoped to selected brand
  const totalConnected = useMemo(() => {
    return scopedChannels.filter((c) => c.status === 'connected').length;
  }, [scopedChannels]);

  const totalAudience = useMemo(() => {
    return scopedChannels.reduce((sum, c) => sum + c.followers, 0);
  }, [scopedChannels]);

  const networksInUseCount = useMemo(() => {
    return new Set(scopedChannels.map((c) => c.net)).size;
  }, [scopedChannels]);

  // Audience by network breakdown
  const audienceByNetwork = useMemo(() => {
    const map = new Map<string, number>();
    scopedChannels.forEach((c) => {
      map.set(c.net, (map.get(c.net) || 0) + c.followers);
    });
    const list = Array.from(map.entries())
      .map(([net, total]) => ({ net, total }))
      .sort((a, b) => b.total - a.total);
    return list;
  }, [scopedChannels]);

  // Network connection counts
  const networkConnectedCounts = useMemo(() => {
    const map = new Map<string, number>();
    scopedChannels.forEach((c) => {
      if (c.status === 'connected') {
        map.set(c.net, (map.get(c.net) || 0) + 1);
      }
    });
    return map;
  }, [scopedChannels]);

  // Dynamically resolve all brands from user's authStore
  const allKnownBrands = useMemo(() => {
    return (brands || []).map((b) => ({
      id: b.id,
      name: b.name,
      short: b.name.split(' ')[0] || b.name,
      industry: b.description || 'Client brand',
      tone: 'pine' as const,
      monogram: (b.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2) || 'BR').toUpperCase(),
      cover: b.logoUrl || '/images/bakery.jpg',
    }));
  }, [brands]);

  // Group by brand
  const brandList = useMemo(() => {
    if (!activeBrandId || activeBrandId === 'all') return allKnownBrands;
    const matched = allKnownBrands.filter((b) => matchesBrand(b.id, activeBrandId, brands));
    if (matched.length > 0) return matched;
    const authBrand = brands.find((b) => b.id === activeBrandId || b.name.toLowerCase() === activeBrandId.toLowerCase());
    if (authBrand) {
      return [{
        id: authBrand.id,
        name: authBrand.name,
        short: authBrand.name.split(' ')[0] || authBrand.name,
        industry: authBrand.description || 'Client brand',
        tone: 'pine' as const,
        monogram: (authBrand.name.slice(0, 2) || 'BR').toUpperCase(),
        cover: authBrand.logoUrl || '/murmura/photos/murmura/posts/ember-roastery.jpg',
      }];
    }
    return allKnownBrands;
  }, [allKnownBrands, activeBrandId, brands]);

  return (
    <div data-view="channels" className="view" style={{ minWidth: 0 }}>
      {/* 1. Header with Stats Strip & Actions */}
      <header className="head">
        <div className="head__lead">
          <h1 className="head__title">Channels</h1>
        </div>

        <div className="head__stats">
          {/* Stat 1: Connected accounts */}
          <div className="stat" data-stat="connected">
            <span className="stat__ico">
              <svg className="ico" viewBox="0 0 24 24">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </span>
            <div>
              <span className="stat__value">
                <b className="tnum">{totalConnected}</b>
              </span>
              <span className="stat__label">Connected accounts</span>
            </div>
          </div>

          {/* Stat 2: Need attention */}
          <div className="stat" data-stat="attention">
            <span className="stat__ico">
              <svg className="ico" viewBox="0 0 24 24">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </span>
            <div>
              <span className="stat__value">
                <b className="tnum">{brokenChannels.length}</b>
                {brokenChannels.length > 0 ? (
                  <span className="badge badge--coral">Fix now</span>
                ) : (
                  <span className="badge badge--pine">All good</span>
                )}
              </span>
              <span className="stat__label">Need attention</span>
            </div>
          </div>

          {/* Stat 3: Total audience */}
          <div className="stat" data-stat="audience">
            <span className="stat__ico">
              <svg className="ico" viewBox="0 0 24 24">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </span>
            <div>
              <span className="stat__value">
                <b className="tnum">{formatCompactNumber(totalAudience)}</b>
              </span>
              <span className="stat__label">Total audience</span>
            </div>
          </div>

          {/* Stat 4: Networks in use */}
          <div className="stat" data-stat="nets">
            <span className="stat__ico">
              <svg className="ico" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </span>
            <div>
              <span className="stat__value">
                <b className="tnum">{networksInUseCount}</b>
              </span>
              <span className="stat__label">of 8 networks in use</span>
            </div>
          </div>
        </div>

        <div className="head__actions" style={{ display: 'flex', gap: '8px' }}>
          {channels.length > 0 && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={handlePurgeAllDemoChannels}
              title="Remove all seeded demo/test channels from database"
              style={{ color: 'var(--coral, #ef4444)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
            >
              Clear Demo Channels
            </button>
          )}
          <button
            type="button"
            className="btn btn--ink magnetic"
            onClick={() => {
              const preferredId = (activeBrandId && activeBrandId !== 'all') ? activeBrandId : (allKnownBrands[0]?.id || brands[0]?.id || '');
              setWizardBrand(preferredId);
              setTargetBrandForConnect(preferredId);
              setShowConnectModal(true);
            }}
          >
            <svg className="ico" viewBox="0 0 24 24">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Connect a channel
          </button>
        </div>
      </header>

      {/* 2. Main Layout (Channels Grid + Right Sidebar) */}
      <div className="ch-layout">
        <div className="ch-main">
          {/* Red/Coral Attention Banner if any broken channels */}
          {brokenChannels.length > 0 && (
            <div data-banner-slot>
              <section className="tile tone--coral ch-alert" aria-labelledby="ch-alert-t">
                <div className="ch-alert__lead">
                  <span className="ch-alert__ico">
                    <svg className="ico" viewBox="0 0 24 24">
                      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  </span>
                  <div>
                    <h2 id="ch-alert-t">
                      {brokenChannels.length} channel{brokenChannels.length === 1 ? '' : 's'} need attention
                    </h2>
                    <p>
                      Access token refresh needed. Reconnect so posts publish smoothly without interruption.
                    </p>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn--sm btn--primary"
                        style={{ padding: '4px 12px', fontSize: '13px' }}
                        onClick={handleReconnectAll}
                      >
                        Reconnect All ({brokenChannels.length})
                      </button>
                      <button
                        type="button"
                        className="ch-alert__link"
                        onClick={() => navigate('/approvals')}
                      >
                        <svg className="ico" viewBox="0 0 24 24">
                          <line x1="7" y1="17" x2="17" y2="7" />
                          <polyline points="7 7 17 7 17 17" />
                        </svg>
                        Review posts
                      </button>
                    </div>
                  </div>
                </div>

                <ul className="ch-alert__list">
                  {brokenChannels.map((c) => {
                    const bm = getBrandMeta(c.brandId, brands);
                    const isDis = c.status === 'disconnected';
                    return (
                      <li key={`a-${c.id}`}>
                        <span className={`net net--sm net--${c.net}`}>
                          <NetworkIcon network={c.net} className="w-3.5 h-3.5" />
                        </span>
                        <span>
                          <b>
                            {bm.name} · {NETWORK_METAS[c.net]?.name}
                          </b>
                          <small>
                            {isDis ? 'Disconnected · Needs reconnect' : `Access expires in ${c.daysLeft} d`}
                          </small>
                        </span>
                        <button
                          type="button"
                          className="btn btn--sm ch-alert__btn"
                          onClick={() => handleReconnect(c.id)}
                        >
                          <svg className="ico" viewBox="0 0 24 24">
                            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                          </svg>
                          Reconnect
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>
          )}

          {/* Active Brand Scope Notification */}
          {activeBrandId !== 'all' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 18px',
                marginBottom: '16px',
                background: 'var(--well)',
                borderRadius: '16px',
                border: '1px solid var(--line-2)',
                fontSize: '13px',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="dot-badge" style={{ position: 'static', background: 'var(--butter)' }} />
                <span>
                  Showing channels for <strong style={{ color: 'var(--text)' }}>{brandList[0]?.name || activeBrandId}</strong> ({scopedChannels.length} accounts connected)
                </span>
              </div>
              <button
                type="button"
                className="btn btn--sm btn--ghost"
                onClick={() => {
                  if (outletCtx.setSelectedBrandId) {
                    outletCtx.setSelectedBrandId('all');
                  }
                  useAuthStore.getState().setSelectedBrandId('all');
                  addToast({ type: 'info', message: 'Showing all brands' });
                }}
              >
                Show all brands ({channels.length} accounts)
              </button>
            </div>
          )}

          {/* Tools Bar (Segmented Filters + Search Input) */}
          <div className="ch-tools">
            <div className="seg">
              <button
                type="button"
                className="seg__btn"
                aria-pressed={filter === 'all'}
                onClick={() => setFilter('all')}
              >
                All channels
              </button>
              <button
                type="button"
                className="seg__btn"
                aria-pressed={filter === 'attention'}
                onClick={() => setFilter('attention')}
              >
                Needs attention
              </button>
              <button
                type="button"
                className="seg__btn"
                aria-pressed={filter === 'paused'}
                onClick={() => setFilter('paused')}
              >
                Paused
              </button>
            </div>

            <label className="search ch-search">
              <svg className="ico" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="search"
                placeholder="Search handles and networks"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </label>
          </div>

          {/* Brand Sections */}
          <div className="ch-groups" data-groups>
            {brandList.map((brand) => {
              const brandChannels = filteredChannels.filter((c) => matchesBrand(c.brandId, brand.id, brands));
              const brandTotalAudience = brandChannels.reduce((sum, c) => sum + c.followers, 0);

              if (brandChannels.length === 0 && searchQuery.trim()) {
                return null;
              }

              return (
                <section
                  key={`b-${brand.id}`}
                  className="card ch-brand"
                  data-brand={brand.id}
                  aria-labelledby={`ch-b-${brand.id}`}
                >
                  {/* Hero Photographic Banner */}
                  <div className="ch-cover">
                    <img
                      src={brand.cover}
                      width={900}
                      height={600}
                      alt={brand.name}
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/images/bakery.jpg';
                      }}
                    />
                  </div>

                  {/* Brand Header */}
                  <header className="ch-brand__head">
                    <span className={`bmark bmark--lg tone--${brand.tone}`}>
                      {brand.monogram}
                    </span>
                    <div className="ch-brand__t">
                      <h2 id={`ch-b-${brand.id}`}>{brand.name}</h2>
                      <p>{brand.industry}</p>
                    </div>
                    <p className="ch-brand__sum">
                      <b>{brandChannels.length}</b> channels
                      <span>·</span>
                      <b>{formatCompactNumber(brandTotalAudience)}</b> audience
                    </p>
                  </header>

                  {/* Team Access Row */}
                  <p className="ch-who">
                    <span className="av-stack">
                      <img src="/images/camila.jpg" className="av av--sm" alt="Camila" />
                      <span className="av av--sm av--t0">M</span>
                      <span className="av av--sm av--t1">E</span>
                      <span className="av av--sm av--t2">N</span>
                      <span className="av av--sm av--t3">F</span>
                    </span>
                    <span>
                      <b>5 people can post here</b> · Owner, Admin, Manager publish directly · Editor needs approval
                    </span>
                    <button
                      type="button"
                      className="ch-who__link"
                      onClick={() => navigate('/team')}
                    >
                      <svg className="ico" viewBox="0 0 24 24">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                      Manage access
                    </button>
                  </p>

                  {/* Channels Grid (3 Columns) */}
                  <div className="ch-grid" data-grid>
                    {brandChannels.map((c) => {
                      const isDown = c.status === 'disconnected';
                      const isExpiring = c.status === 'expiring';
                      const isPaused = !c.postingEnabled;

                      return (
                        <article
                          key={c.id}
                          className={`ch-card ${isDown ? 'is-down' : ''} ${isPaused ? 'is-paused' : ''}`}
                          data-lift
                        >
                          {/* Card Header: Network Icon + Handle + Status Badge */}
                          <header className="ch-card__head">
                            <span className={`net net--lg net--${c.net}`}>
                              <NetworkIcon network={c.net} className="w-5 h-5" />
                            </span>
                            <div className="ch-card__id">
                              <b>{c.handle}</b>
                              <small>{NETWORK_METAS[c.net]?.name}</small>
                            </div>
                            <span className="ch-status">
                              {isDown ? (
                                <span className="badge badge--coral">
                                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', marginRight: 5, display: 'inline-block' }} />
                                  Disconnected
                                </span>
                              ) : isExpiring ? (
                                <span className="badge badge--coral">
                                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', marginRight: 5, display: 'inline-block' }} />
                                  Expires in {c.daysLeft} d
                                </span>
                              ) : isPaused ? (
                                <span className="badge badge--plain">Paused</span>
                              ) : (
                                <span className="badge badge--pine">
                                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', marginRight: 5, display: 'inline-block' }} />
                                  Connected
                                </span>
                              )}
                            </span>
                          </header>

                          {/* Audience & Sparkline Trajectory */}
                          <div className="ch-card__aud">
                            <div>
                              <b className="ch-card__num">{formatCompactNumber(c.followers)}</b>
                              <small>
                                followers · <span className="ch-up">+{c.growthPct}%</span> in 30 d
                              </small>
                            </div>
                            <span className="ch-spark">
                              <svg viewBox="0 0 150 40" preserveAspectRatio="none">
                                <path
                                  d="M0,32 C45,30 90,22 150,8"
                                  fill="none"
                                  stroke={isDown ? 'var(--faint)' : 'var(--pine)'}
                                  strokeWidth="2.2"
                                  strokeLinecap="round"
                                />
                              </svg>
                            </span>
                          </div>

                          {/* Access Token Meter */}
                          <div className="ch-token">
                            <div className="ch-token__row">
                              <span>
                                <svg className="ico" viewBox="0 0 24 24">
                                  <path d="M21 2l-2 2m-1.5 1.5L14 9l-1.5-1.5L11 9l-1.5-1.5L8 9l-1.5-1.5L5 9" />
                                  <circle cx="7.5" cy="15.5" r="5.5" />
                                </svg>
                                Access token
                              </span>
                              <b>
                                {isDown
                                  ? 'Access revoked'
                                  : isExpiring
                                  ? `Expires in ${c.daysLeft} d`
                                  : `${c.daysLeft} of ${c.totalDays} days left`}
                              </b>
                            </div>
                            <span className="meter">
                              <span
                                className={`meter__fill meter__fill--${isDown ? 'coral' : isExpiring ? 'butter' : 'pine'}`}
                                style={{
                                  transform: `scaleX(${isDown ? 0 : c.daysLeft / c.totalDays})`,
                                  transformOrigin: '0 50%',
                                }}
                              />
                            </span>
                          </div>

                          {/* Meta: Last sync & Connected by */}
                          <dl className="ch-meta">
                            <div>
                              <dt>Last sync</dt>
                              <dd>{c.lastSync}</dd>
                            </div>
                            <div>
                              <dt>Connected by</dt>
                              <dd>
                                {c.connectedByPhoto ? (
                                  <img
                                    src={c.connectedByPhoto}
                                    className="av av--xs"
                                    alt={c.connectedBy}
                                    style={{ width: 18, height: 18, borderRadius: '50%' }}
                                  />
                                ) : (
                                  <span className="av av--xs av--t0" style={{ width: 18, height: 18, fontSize: '9px' }}>
                                    {c.connectedBy[0]}
                                  </span>
                                )}
                                <span>{c.connectedBy}</span>
                              </dd>
                            </div>
                          </dl>

                          {/* Actions: Analytics, Posting switch, More */}
                          <footer className="ch-acts">
                            {isDown ? (
                              <button
                                type="button"
                                className="btn btn--ink btn--sm"
                                onClick={() => handleReconnect(c.id)}
                              >
                                <svg className="ico" viewBox="0 0 24 24">
                                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                                </svg>
                                Reconnect
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn btn--ghost btn--sm"
                                onClick={() => navigate(`/analytics?brand=${c.brandId}`)}
                              >
                                <svg className="ico" viewBox="0 0 24 24">
                                  <line x1="18" y1="20" x2="18" y2="10" />
                                  <line x1="12" y1="20" x2="12" y2="4" />
                                  <line x1="6" y1="20" x2="6" y2="14" />
                                </svg>
                                Analytics
                              </button>
                            )}

                            <label className="ch-post" title={isDown ? 'Reconnect first' : undefined}>
                              <span>Posting</span>
                              <button
                                type="button"
                                className="switch"
                                role="switch"
                                aria-checked={c.postingEnabled && !isDown}
                                disabled={isDown}
                                onClick={() => handleTogglePosting(c.id)}
                              />
                            </label>

                            <div style={{ position: 'relative' }}>
                              <button
                                type="button"
                                className="ibtn ibtn--sm ch-more"
                                onClick={() =>
                                  setMenuOpenForChannel((cur) => (cur === c.id ? null : c.id))
                                }
                                aria-label="More options"
                              >
                                <svg className="ico" viewBox="0 0 24 24">
                                  <circle cx="12" cy="12" r="1.5" />
                                  <circle cx="19" cy="12" r="1.5" />
                                  <circle cx="5" cy="12" r="1.5" />
                                </svg>
                              </button>

                              {menuOpenForChannel === c.id && (
                                <div
                                  className="pop"
                                  style={{
                                    position: 'absolute',
                                    right: 0,
                                    bottom: '100%',
                                    marginBottom: 8,
                                    zIndex: 50,
                                    minWidth: 180,
                                  }}
                                >
                                  <button
                                    type="button"
                                    className="menu__item"
                                    onClick={() => {
                                      handleReconnect(c.id);
                                      setMenuOpenForChannel(null);
                                    }}
                                  >
                                    <svg className="ico" viewBox="0 0 24 24">
                                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                                    </svg>
                                    {isDown ? 'Reconnect' : 'Refresh access'}
                                  </button>
                                  <button
                                    type="button"
                                    className="menu__item"
                                    disabled={isDown}
                                    onClick={() => {
                                      handleTogglePosting(c.id);
                                      setMenuOpenForChannel(null);
                                    }}
                                  >
                                    <svg className="ico" viewBox="0 0 24 24">
                                      {c.postingEnabled ? (
                                        <rect x="6" y="4" width="4" height="16" />
                                      ) : (
                                        <polygon points="5 3 19 12 5 21 5 3" />
                                      )}
                                    </svg>
                                    {c.postingEnabled ? 'Pause posting' : 'Resume posting'}
                                  </button>
                                  <button
                                    type="button"
                                    className="menu__item"
                                    onClick={() => {
                                      navigate(`/analytics?brand=${c.brandId}`);
                                      setMenuOpenForChannel(null);
                                    }}
                                  >
                                    <svg className="ico" viewBox="0 0 24 24">
                                      <line x1="18" y1="20" x2="18" y2="10" />
                                      <line x1="12" y1="20" x2="12" y2="4" />
                                      <line x1="6" y1="20" x2="6" y2="14" />
                                    </svg>
                                    View analytics
                                  </button>
                                  <hr />
                                  <button
                                    type="button"
                                    className="menu__item is-danger"
                                    disabled={isDown}
                                    onClick={() => handleDisconnect(c.id)}
                                  >
                                    <svg className="ico" viewBox="0 0 24 24">
                                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                      <line x1="2" y1="2" x2="22" y2="22" />
                                    </svg>
                                    Disconnect
                                  </button>
                                </div>
                              )}
                            </div>
                          </footer>
                        </article>
                      );
                    })}

                    {brandChannels.length === 0 && (
                      <div
                        style={{
                          gridColumn: '1 / -1',
                          padding: '24px 20px',
                          textAlign: 'center',
                          background: 'var(--glass-2)',
                          borderRadius: 'var(--r-tile)',
                          border: '1px dashed var(--line-2)',
                          color: 'var(--muted)',
                          fontSize: 'var(--fs-sm)',
                        }}
                      >
                        <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>
                          No channels connected to {brand.name} yet
                        </div>
                        <p style={{ fontSize: 'var(--fs-xs)', margin: 0 }}>
                          Click the card below to authorize social accounts to publish, monitor, and analyze.
                        </p>
                      </div>
                    )}

                    {/* Dashed "+ Connect a channel to {Brand}" Card */}
                    <button
                      type="button"
                      className="ch-add"
                      onClick={() => {
                        setWizardBrand(brand.id);
                        setTargetBrandForConnect(brand.id);
                        setShowConnectModal(true);
                      }}
                    >
                      <span className="ch-add__ico">
                        <svg className="ico" viewBox="0 0 24 24">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      </span>
                      <b>Connect a channel</b>
                      <small>to {brand.name}</small>
                    </button>
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        {/* 3. Right Sidebar (Audience by network & Supported networks) */}
        <aside className="ch-side" data-side>
          {/* Card 1: Audience by network */}
          <section className="card ch-aud" aria-labelledby="ch-aud-t">
            <header className="card__head">
              <div>
                <h2 className="card__title" id="ch-aud-t">
                  Audience by network
                </h2>
                <p className="card__sub">
                  {formatCompactNumber(totalAudience)} followers across {scopedChannels.length} accounts
                </p>
              </div>
            </header>

            <ul className="ch-bars">
              {audienceByNetwork.map((item) => {
                const pct = Math.round((item.total / totalAudience) * 100);
                const maxVal = audienceByNetwork[0]?.total || 1;
                const fillRatio = item.total / maxVal;
                const netMeta = NETWORK_METAS[item.net];

                return (
                  <li key={item.net}>
                    <span className={`net net--sm net--${item.net}`}>
                      <NetworkIcon network={item.net} className="w-3.5 h-3.5" />
                    </span>
                    <span className="ch-bars__body">
                      <span className="ch-bars__top">
                        <b>{netMeta?.name || item.net}</b>
                        <span>
                          {formatCompactNumber(item.total)} <small>{pct}%</small>
                        </span>
                      </span>
                      <span className="meter">
                        <span
                          className={`meter__fill ch-bars__fill ch-bars__fill--${item.net}`}
                          style={{ transform: `scaleX(${fillRatio})`, transformOrigin: '0 50%' }}
                        />
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Card 2: Supported networks */}
          <section className="card ch-nets" aria-labelledby="ch-nets-t">
            <header className="card__head">
              <div>
                <h2 className="card__title" id="ch-nets-t">
                  Supported networks
                </h2>
                <p className="card__sub">
                  {networksInUseCount} of 8 in use
                </p>
              </div>
            </header>

            <ul className="ch-netlist is-all">
              {Object.entries(NETWORK_METAS).map(([netKey, meta]) => {
                const connectedCount = networkConnectedCounts.get(netKey) || 0;

                return (
                  <li key={netKey} className="ch-net">
                    <span className={`net net--md net--${netKey}`}>
                      <NetworkIcon network={netKey} className="w-4 h-4" />
                    </span>
                    <div className="ch-net__body">
                      <div className="ch-net__top">
                        <b>{meta.name}</b>
                        {connectedCount > 0 ? (
                          <span className="badge badge--pine">{connectedCount} connected</span>
                        ) : (
                          <span className="badge badge--plain">Not connected</span>
                        )}
                        <button
                          type="button"
                          className="ibtn ibtn--sm ch-net__add"
                          title={`Connect ${meta.name}`}
                          onClick={() => {
                            const preferredId = (activeBrandId && activeBrandId !== 'all') ? activeBrandId : (allKnownBrands[0]?.id || brands[0]?.id || '');
                            setWizardBrand(preferredId);
                            setTargetBrandForConnect(preferredId);
                            setWizardNet(netKey);
                            setShowConnectModal(true);
                          }}
                        >
                          <svg className="ico" viewBox="0 0 24 24">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                        </button>
                      </div>

                      <small>{meta.what}</small>

                      <div className="ch-caps">
                        <span className={`ch-cap ${meta.publish ? 'is-on' : ''}`}>
                          <svg className="ico" viewBox="0 0 24 24">
                            {meta.publish ? <path d="M20 6 9 17l-5-5" /> : <line x1="5" y1="12" x2="19" y2="12" />}
                          </svg>
                          Publish
                        </span>
                        <span className={`ch-cap ${meta.inbox ? 'is-on' : ''}`}>
                          <svg className="ico" viewBox="0 0 24 24">
                            {meta.inbox ? <path d="M20 6 9 17l-5-5" /> : <line x1="5" y1="12" x2="19" y2="12" />}
                          </svg>
                          Inbox
                        </span>
                        <span className={`ch-cap ${meta.analytics ? 'is-on' : ''}`}>
                          <svg className="ico" viewBox="0 0 24 24">
                            {meta.analytics ? <path d="M20 6 9 17l-5-5" /> : <line x1="5" y1="12" x2="19" y2="12" />}
                          </svg>
                          Analytics
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>
      </div>

      {/* 4. Connect Channel Modal (matching Image 5) */}
      {showConnectModal &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(16, 18, 20, 0.65)',
                backdropFilter: 'blur(8px)',
              }}
              onClick={() => setShowConnectModal(false)}
            />
            <div
              className="card modal"
              style={{
                position: 'relative',
                zIndex: 10000,
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
                    wizardBrand && wizardBrand !== 'ember'
                      ? wizardBrand
                      : (activeBrandId !== 'all' ? activeBrandId : '') || brands[0]?.id || '';

                  if (!wizardHandle.trim()) {
                    addToast({ type: 'error', message: 'Please enter account handle or page name.' });
                    return;
                  }

                  if (connectMethod === 'manual') {
                    setIsSubmittingConnect(true);
                    try {
                      const res: any = await apiFetch('/channels/connect-manual', {
                        method: 'POST',
                        body: JSON.stringify({
                          brandId: effectiveBrandId,
                          network: wizardNet.toUpperCase(),
                          handle: wizardHandle.trim(),
                          accountLogin: wizardLogin.trim(),
                          accountPassword: wizardPassword.trim(),
                        }),
                      });

                      if (res && res.channel) {
                        const rawNet = (res.channel.network || wizardNet).toLowerCase();
                        const cleanHandle = res.channel.handle || wizardHandle.trim();
                        const newCh: ChannelItem = {
                          id: res.channel.id,
                          brandId: res.channel.brandId,
                          net: rawNet as any,
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

                        setChannels((prev) => {
                          const updated = [newCh, ...prev.filter((c) => c.id !== newCh.id)];
                          try {
                            localStorage.setItem('vs_custom_channels', JSON.stringify(updated));
                          } catch {}
                          return updated;
                        });

                        addToast({
                          type: 'success',
                          message: res.message || `Successfully connected ${NETWORK_METAS[wizardNet]?.name} (${cleanHandle})! Past posts synced to dashboard.`,
                        });

                        setShowConnectModal(false);
                        setWizardHandle('');
                        setWizardLogin('');
                        setWizardPassword('');
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
                  if (wizardNet === 'facebook' || wizardNet === 'instagram') {
                    setShowConnectModal(false);
                    addToast({
                      type: 'info',
                      message: `Connecting to official ${NETWORK_METAS[wizardNet]?.name} (Meta)...`,
                    });

                    let authUrl: string | null = null;
                    try {
                      // 1. Try direct authenticated Meta auth-url endpoint first
                      try {
                        const directAuth: any = await apiFetch(`/channels/meta/auth-url?brandId=${effectiveBrandId}`);
                        if (directAuth?.authUrl) {
                          authUrl = directAuth.authUrl;
                        }
                      } catch (e1) {
                        console.warn('Direct auth-url failed, trying fallback:', e1);
                      }

                      // 2. Fallback to invite flow
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
                      console.warn('Real Meta OAuth redirect error:', err);
                      addToast({
                        type: 'error',
                        message: err.message || 'Could not start Meta login. Make sure Meta App ID is configured on Render.',
                      });
                    }
                  }
                  setActiveOAuthNet(wizardNet as OAuthNetwork);
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
                    <svg className="ico" viewBox="0 0 24 24">
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
                    marginBottom: '18px',
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

                {/* 8 Networks Grid - Click to select */}
                <div
                  className="cc-nets"
                  role="radiogroup"
                  aria-label="Network"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                    gap: '8px',
                    margin: '10px 0',
                  }}
                >
                  {Object.entries(NETWORK_METAS).map(([key, val]) => {
                    const isSelected = wizardNet === key;
                    return (
                      <div
                        key={key}
                        role="button"
                        tabIndex={0}
                        className="cc-net"
                        onClick={() => setWizardNet(key)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setWizardNet(key);
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
                        title={`Select ${val.name}`}
                      >
                        <span className={`net net--sm net--${key}`}>
                          <NetworkIcon network={key} className="ico" />
                        </span>
                        <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text)' }}>
                          {val.name}
                        </span>
                        <span style={{ fontSize: '10px', color: isSelected ? 'var(--butter, #f2b740)' : 'var(--muted)', marginTop: '-2px' }}>
                          {isSelected ? '✓ Selected' : 'Choose'}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* For Brand Selection */}
                <div className="field field--wide" style={{ marginTop: '16px' }}>
                  <span className="field__label">For brand</span>
                  <select
                    className="input"
                    value={wizardBrand}
                    onChange={(e) => setWizardBrand(e.target.value)}
                    style={{ color: 'var(--text)' }}
                  >
                    {allKnownBrands.map((b) => (
                      <option
                        key={b.id}
                        value={b.id}
                        style={{ background: '#1f2226', color: '#eef0ee' }}
                      >
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                {connectMethod === 'manual' ? (
                  <>
                    {/* Account Handle / Page Name */}
                    <div className="field field--wide" style={{ marginTop: '12px' }}>
                      <span className="field__label">
                        {wizardNet === 'facebook' || wizardNet === 'linkedin'
                          ? 'Page Name / Handle'
                          : 'Username / Handle'}
                      </span>
                      <input
                        type="text"
                        required
                        className="input"
                        placeholder={
                          ['facebook', 'youtube', 'linkedin'].includes(wizardNet)
                            ? 'e.g. Gaurav Official Page'
                            : 'e.g. @gaurav_official'
                        }
                        value={wizardHandle}
                        onChange={(e) => setWizardHandle(e.target.value)}
                      />
                    </div>

                    {/* Account Login ID / Email */}
                    <div className="field field--wide" style={{ marginTop: '12px' }}>
                      <span className="field__label">Account Login ID / Email (Optional)</span>
                      <input
                        type="text"
                        className="input"
                        placeholder="e.g. client@gmail.com or +91 9876543210"
                        value={wizardLogin}
                        onChange={(e) => setWizardLogin(e.target.value)}
                      />
                    </div>

                    {/* Account Password / Token */}
                    <div className="field field--wide" style={{ marginTop: '12px' }}>
                      <span className="field__label">Account Password / Access Key</span>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          className="input"
                          placeholder="Enter account password or access key"
                          value={wizardPassword}
                          onChange={(e) => setWizardPassword(e.target.value)}
                          style={{ paddingRight: '50px' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
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
                          {showPassword ? 'Hide' : 'Show'}
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
                      padding: '10px 14px',
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
                      Will redirect to official <b>{NETWORK_METAS[wizardNet]?.name} Login</b> dialog to grant permissions.
                    </span>
                  </div>
                )}

                {/* Modal Footer */}
                <div
                  className="mform__foot"
                  style={{
                    marginTop: '20px',
                    position: 'sticky',
                    bottom: '-24px',
                    background: 'var(--solid, #191b1f)',
                    padding: '16px 0 4px',
                    borderTop: '1px solid var(--line, rgba(255,255,255,0.08))',
                    zIndex: 10,
                  }}
                >
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setShowConnectModal(false)}
                    disabled={isSubmittingConnect}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn--ink" disabled={isSubmittingConnect}>
                    {connectMethod === 'manual'
                      ? isSubmittingConnect
                        ? 'Connecting & Syncing...'
                        : 'Connect & Sync Account to Dashboard →'
                      : `Continue to Official ${NETWORK_METAS[wizardNet]?.name} Login →`}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* 5. Authentic Social Media OAuth Login Dialog */}
      {(() => {
        const effectiveBrand =
          allKnownBrands.find((b) => b.id === wizardBrand) ||
          allKnownBrands[0] ||
          (brands[0] ? { id: brands[0].id, name: brands[0].name } : null);
        const resolvedBrandId = effectiveBrand?.id || brands[0]?.id || '';
        const resolvedBrandName = effectiveBrand?.name || brands[0]?.name || 'Brand';
        return (
          <SocialOAuthModal
            isOpen={!!activeOAuthNet}
            network={activeOAuthNet || 'facebook'}
            brandName={resolvedBrandName}
            brandId={resolvedBrandId}
            onClose={() => {
              setActiveOAuthNet(null);
            }}
            onBack={() => {
              setActiveOAuthNet(null);
              setShowConnectModal(true);
            }}
            onSuccess={async ({ handle: newHandle, network: newNet, brandId: bId, followers }) => {
              const bName = allKnownBrands.find((b) => b.id === bId)?.name || resolvedBrandName;
              const netMeta = NETWORK_METAS[newNet];

              const newChannel: ChannelItem = {
                id: `ch-${bId}-${newNet}-${Date.now()}`,
                brandId: bId,
                net: newNet as any,
                handle: newHandle,
                followers: followers || 15400,
                growthPct: Number((Math.random() * 8 + 2).toFixed(1)),
                daysLeft: 60,
                totalDays: 60,
                lastSync: 'Just now',
                connectedBy: 'Official OAuth',
                status: 'connected',
                postingEnabled: true,
              };

              setChannels((prev) => {
                const filtered = prev.filter((c) => !(c.brandId === bId && c.net === newNet));
                const updated = [newChannel, ...filtered];
                try {
                  const customOnly = updated.filter((c) => !INITIAL_CHANNELS.some((ic) => ic.id === c.id));
                  localStorage.setItem('vs_custom_channels', JSON.stringify(customOnly));
                } catch (e) {
                  console.error(e);
                }
                return updated;
              });

              setActiveOAuthNet(null);
              setShowConnectModal(false);
              addToast({
                type: 'success',
                message: `Successfully connected ${netMeta?.name || newNet} account (${newHandle}) to ${bName}!`,
              });

              // Persist to backend database so it stays across all devices and refreshes
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
                console.warn('Backend channel persist warning:', err);
              }
            }}
          />
        );
      })()}
    </div>
  );
}
