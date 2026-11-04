import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { API_BASE } from '../../lib/api.js';
import { NetworkIcon } from '../common/NetworkIcon.js';

const getPublicApiUrl = (endpoint: string) => {
  const clean = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE}/api/v1/public/connect${clean}`;
};

interface BrandPublicInfo {
  id: string;
  name: string;
  logoUrl?: string;
  color?: string;
  description?: string;
}

interface ExistingChannel {
  id: string;
  network: string;
  handle: string;
  status: string;
}

interface PageCandidate {
  pageId: string;
  pageName: string;
  instagram?: {
    id: string;
    username: string;
    profilePictureUrl?: string;
  };
}

interface SupportedNetwork {
  id: string;
  name: string;
  network: string;
  description: string;
  color: string;
  gradient: string;
  defaultPrefix: string;
  scopes: string[];
}

const SUPPORTED_NETWORKS: SupportedNetwork[] = [
  {
    id: 'facebook',
    name: 'Facebook Page',
    network: 'FACEBOOK',
    description: 'Publish posts, reels, video updates & monitor page engagement',
    color: '#1877F2',
    gradient: 'linear-gradient(135deg, #1877F2 0%, #0c56c2 100%)',
    defaultPrefix: '',
    scopes: ['Manage & publish posts to your Page', 'View Page reach and engagement metrics'],
  },
  {
    id: 'instagram',
    name: 'Instagram Business',
    network: 'INSTAGRAM',
    description: 'Schedule reels, carousels, stories & track follower growth',
    color: '#E1306C',
    gradient: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
    defaultPrefix: '@',
    scopes: ['Publish reels, stories & photo posts', 'Access account analytics & performance insights'],
  },
  {
    id: 'linkedin',
    name: 'LinkedIn Company / Profile',
    network: 'LINKEDIN',
    description: 'Publish business updates, articles, company news & lead metrics',
    color: '#0A66C2',
    gradient: 'linear-gradient(135deg, #0A66C2 0%, #004182 100%)',
    defaultPrefix: '',
    scopes: ['Publish posts & articles to Company Page', 'Monitor visitor engagement & member reactions'],
  },
  {
    id: 'x',
    name: 'X (Twitter)',
    network: 'X',
    description: 'Post tweets, threads, video clips & engage with mentions',
    color: '#0f172a',
    gradient: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
    defaultPrefix: '@',
    scopes: ['Publish posts and threads on your behalf', 'Monitor brand replies and impressions'],
  },
  {
    id: 'youtube',
    name: 'YouTube Channel',
    network: 'YOUTUBE',
    description: 'Schedule YouTube Shorts, long-form videos & track subscriber growth',
    color: '#FF0000',
    gradient: 'linear-gradient(135deg, #cc0000 0%, #ff0000 100%)',
    defaultPrefix: '',
    scopes: ['Upload & schedule video content & Shorts', 'Read watch time and viewer reach statistics'],
  },
  {
    id: 'tiktok',
    name: 'TikTok Business',
    network: 'TIKTOK',
    description: 'Publish short-form video reels, trends & monitor viewer reach',
    color: '#fe2c55',
    gradient: 'linear-gradient(135deg, #010101 0%, #16181f 100%)',
    defaultPrefix: '@',
    scopes: ['Publish video content directly to TikTok', 'View audience trends and demographic analytics'],
  },
  {
    id: 'pinterest',
    name: 'Pinterest',
    network: 'PINTEREST',
    description: 'Publish product pins, visual collections & track saves and clicks',
    color: '#E60023',
    gradient: 'linear-gradient(135deg, #ad081b 0%, #e60023 100%)',
    defaultPrefix: '',
    scopes: ['Create & publish Pins to public boards', 'Read Pin impressions, repins & outbound clicks'],
  },
  {
    id: 'threads',
    name: 'Threads',
    network: 'THREADS',
    description: 'Share text thoughts, media updates & join brand conversations',
    color: '#111827',
    gradient: 'linear-gradient(135deg, #111827 0%, #1f2937 100%)',
    defaultPrefix: '@',
    scopes: ['Publish threads, quotes and photo updates', 'Access thread reach and follower engagement'],
  },
];

export function PublicConnectView() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();

  const step = searchParams.get('step');
  const sessionId = searchParams.get('sessionId');
  const urlStatus = searchParams.get('status');
  const urlError = searchParams.get('error');
  const urlMessage = searchParams.get('message');

  const [isLoading, setIsLoading] = useState(true);
  const [agencyName, setAgencyName] = useState('');
  const [brand, setBrand] = useState<BrandPublicInfo | null>(null);
  const [existingChannels, setExistingChannels] = useState<ExistingChannel[]>([]);
  const [expiresAt, setExpiresAt] = useState<string>('');

  const [errorState, setErrorState] = useState<{
    code: 'EXPIRED' | 'REVOKED' | 'USED' | 'NOT_FOUND' | 'GENERIC';
    message: string;
  } | null>(null);

  const [isRequestingNewLink, setIsRequestingNewLink] = useState(false);
  const [requestLinkSent, setRequestLinkSent] = useState(false);

  // Multi-page picker state (for Meta OAuth callback flow)
  const [candidates, setCandidates] = useState<PageCandidate[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string>('');
  const [isSubmittingPage, setIsSubmittingPage] = useState(false);
  const [isSuccess, setIsSuccess] = useState(urlStatus === 'success');

  // Channel Connection Modal state
  const [activeModalNet, setActiveModalNet] = useState<SupportedNetwork | null>(null);
  const [customHandle, setCustomHandle] = useState<string>('');
  const [isConnectingChannel, setIsConnectingChannel] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // 1. Initial verify of token
  useEffect(() => {
    if (!token) {
      setErrorState({ code: 'NOT_FOUND', message: 'No connection token provided in the URL.' });
      setIsLoading(false);
      return;
    }

    const verifyToken = async () => {
      try {
        setIsLoading(true);
        const res = await fetch(getPublicApiUrl(`/${token}`));
        const data = await res.json();

        if (!res.ok) {
          const errCode = data?.error?.code;
          if (errCode === 'INVITE_EXPIRED') {
            setErrorState({
              code: 'EXPIRED',
              message: 'This connection link has expired (links are active for 7 days).',
            });
          } else if (errCode === 'INVITE_REVOKED') {
            setErrorState({
              code: 'REVOKED',
              message: 'This connection link has been revoked or replaced with a newer link.',
            });
          } else if (errCode === 'INVITE_ALREADY_USED') {
            setErrorState({
              code: 'USED',
              message: 'This connection link has already been used to connect accounts.',
            });
          } else {
            setErrorState({
              code: 'NOT_FOUND',
              message: data?.error?.message || 'This connection link is invalid or does not exist.',
            });
          }
          return;
        }

        setAgencyName(data.agencyName || 'Your Agency');
        setBrand(data.brand);
        
        // Merge DB existing channels with any local cached channels for this invite
        let mergedChannels: ExistingChannel[] = data.existingChannels || [];
        try {
          const cached = localStorage.getItem(`vs_connected_${token}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) {
              const dbNets = new Set(mergedChannels.map((c) => c.network.toUpperCase()));
              const missing = parsed.filter((c: any) => !dbNets.has(c.network?.toUpperCase()));
              mergedChannels = [...mergedChannels, ...missing];
            }
          }
        } catch {}

        setExistingChannels(mergedChannels);
        setExpiresAt(data.expiresAt);
      } catch (err: any) {
        setErrorState({
          code: 'GENERIC',
          message: 'Unable to reach the connection server. Please check your internet connection.',
        });
      } finally {
        setIsLoading(false);
      }
    };

    verifyToken();
  }, [token]);

  // 2. If multi-page selection step: fetch candidates
  useEffect(() => {
    if (step === 'select-page' && sessionId && token) {
      const fetchCandidates = async () => {
        try {
          const res = await fetch(getPublicApiUrl(`/${token}/pages/${sessionId}`));
          if (res.ok) {
            const data = await res.json();
            setCandidates(data.candidates || []);
            if (data.candidates && data.candidates.length > 0) {
              setSelectedPageId(data.candidates[0].pageId);
            }
          }
        } catch (err) {
          console.error('Failed to load page candidates', err);
        }
      };
      fetchCandidates();
    }
  }, [step, sessionId, token]);

  // Action: Initiate Meta OAuth
  const handleConnectMeta = async () => {
    try {
      const res = await fetch(getPublicApiUrl(`/${token}/oauth/meta`));
      const data = await res.json();
      if (res.ok && data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        alert(data?.error?.message || 'Failed to start Meta connection.');
      }
    } catch {
      alert('Network error initiating Meta authorization.');
    }
  };

  // Action: Open connect modal for a specific network
  const openConnectModal = (net: SupportedNetwork) => {
    setActiveModalNet(net);
    const brandName = brand?.name || 'brand';
    const cleanBrand = brandName.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const prefix = net.defaultPrefix;
    setCustomHandle(prefix ? `${prefix}${cleanBrand}` : brandName);
    setFeedbackMessage(null);
  };

  // Action: Connect any platform via the public channel endpoint
  const handleConfirmChannelConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalNet || !customHandle.trim() || !token) return;

    setIsConnectingChannel(true);
    setFeedbackMessage(null);

    try {
      const res = await fetch(getPublicApiUrl(`/${token}/channel`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          network: activeModalNet.network,
          handle: customHandle.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.channel) {
        setExistingChannels((prev) => {
          const filtered = prev.filter(
            (ch) => ch.network.toUpperCase() !== activeModalNet.network.toUpperCase()
          );
          const updated = [...filtered, data.channel];
          try {
            localStorage.setItem(`vs_connected_${token}`, JSON.stringify(updated));
          } catch {}
          return updated;
        });
        setFeedbackMessage(`✅ ${activeModalNet.name} connected successfully!`);
        setTimeout(() => {
          setActiveModalNet(null);
          setFeedbackMessage(null);
        }, 1200);
      } else {
        alert(data?.error?.message || 'Failed to connect channel.');
      }
    } catch {
      alert('Network error while connecting account. Please try again.');
    } finally {
      setIsConnectingChannel(false);
    }
  };

  // Action: Request New Link
  const handleRequestNewLink = async () => {
    if (!token) return;
    setIsRequestingNewLink(true);
    try {
      const res = await fetch(getPublicApiUrl(`/${token}/request-new-link`), {
        method: 'POST',
      });
      if (res.ok) {
        setRequestLinkSent(true);
      } else {
        const data = await res.json();
        alert(data?.error?.message || 'Failed to send request. Please contact your agency directly.');
      }
    } catch {
      alert('Network error. Please try again later.');
    } finally {
      setIsRequestingNewLink(false);
    }
  };

  // Action: Confirm multi-page selection from Meta callback
  const handleConfirmSelectPage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPageId || !sessionId || !token) return;

    setIsSubmittingPage(true);
    try {
      const res = await fetch(getPublicApiUrl(`/${token}/select-page`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, selectedPageId }),
      });

      if (res.ok) {
        setIsSuccess(true);
      } else {
        const data = await res.json();
        alert(data?.error?.message || 'Failed to bind selected page.');
      }
    } catch {
      alert('Error confirming page selection.');
    } finally {
      setIsSubmittingPage(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f8fafc 0%, #eef2f6 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      {/* Brand Header & Card Container */}
      <div
        style={{
          maxWidth: '580px',
          width: '100%',
          background: '#ffffff',
          borderRadius: '24px',
          boxShadow: '0 20px 50px -15px rgba(15, 23, 42, 0.12), 0 0 1px 1px rgba(15, 23, 42, 0.05)',
          overflow: 'hidden',
          border: '1px solid rgba(226, 232, 240, 0.8)',
        }}
      >
        {/* Top Header Strip */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #f1f5f9',
            background: '#ffffff',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {brand?.logoUrl ? (
              <img
                src={brand.logoUrl}
                alt={brand.name}
                style={{ width: '42px', height: '42px', borderRadius: '12px', objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  background: brand?.color || '#4F46E5',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '16px',
                  display: 'grid',
                  placeItems: 'center',
                  textTransform: 'uppercase',
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
                }}
              >
                {brand?.name ? brand.name.slice(0, 2) : 'VS'}
              </div>
            )}
            <div>
              <div style={{ fontWeight: 800, fontSize: '17px', color: '#0f172a' }}>
                {brand?.name || 'Your Brand'}
              </div>
              <div style={{ fontSize: '12.5px', color: '#64748b' }}>
                Managed by <strong style={{ color: '#334155' }}>{agencyName || 'Agency'}</strong>
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '999px',
              background: '#f1f5f9',
              color: '#475569',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.02em',
            }}
          >
            <span>🔒</span> ZERO PASSWORD
          </div>
        </div>

        {/* Card Body */}
        <div style={{ padding: '24px clamp(16px, 5vw, 28px)' }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  border: '3px solid #e2e8f0',
                  borderTopColor: '#0f172a',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  margin: '0 auto 16px',
                }}
              />
              <span style={{ fontSize: '14px', color: '#64748b' }}>Verifying secure connection link...</span>
            </div>
          ) : errorState ? (
            /* Expired / Revoked Message + Request New Link */
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444',
                  display: 'grid',
                  placeItems: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>

              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: '0 0 8px 0' }}>
                Connection Link No Longer Valid
              </h3>
              <p style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.5, margin: '0 0 24px 0' }}>
                {errorState.message}
              </p>

              {requestLinkSent ? (
                <div
                  style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '12px',
                    padding: '16px',
                    color: '#166534',
                    fontSize: '14px',
                    fontWeight: 500,
                  }}
                >
                  ✅ Request Sent! Your agency ({agencyName}) has been notified and will email you a fresh connection link shortly.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={handleRequestNewLink}
                    disabled={isRequestingNewLink}
                    style={{
                      width: '100%',
                      background: '#0f172a',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '13px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {isRequestingNewLink ? 'Sending Request...' : 'Request New Link'}
                  </button>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Clicking this sends an automated notification to your agency admin.
                  </span>
                </div>
              )}
            </div>
          ) : step === 'select-page' && candidates.length > 0 ? (
            /* Multi-Page Selection Screen (From Meta OAuth) */
            <form onSubmit={handleConfirmSelectPage}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0' }}>
                Select Your Facebook Page
              </h3>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 20px 0' }}>
                Choose which Page belongs to <strong>{brand?.name}</strong>:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                {candidates.map((cand) => (
                  <label
                    key={cand.pageId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: selectedPageId === cand.pageId ? '2px solid #0f172a' : '1px solid #cbd5e1',
                      background: selectedPageId === cand.pageId ? 'rgba(15, 23, 42, 0.03)' : '#ffffff',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="candidatePage"
                      value={cand.pageId}
                      checked={selectedPageId === cand.pageId}
                      onChange={() => setSelectedPageId(cand.pageId)}
                      style={{ accentColor: '#0f172a' }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ fontSize: '14px', color: '#0f172a', display: 'block' }}>
                        {cand.pageName}
                      </strong>
                      {cand.instagram && (
                        <span style={{ fontSize: '12px', color: '#e1306c', display: 'block', marginTop: '2px' }}>
                          Linked Instagram: @{cand.instagram.username}
                        </span>
                      )}
                    </div>
                  </label>
                ))}
              </div>

              <button
                type="submit"
                disabled={isSubmittingPage}
                style={{
                  width: '100%',
                  background: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '14px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {isSubmittingPage ? 'Connecting Accounts...' : 'Confirm & Connect Page'}
              </button>
            </form>
          ) : (
            /* Multi-Platform Social Media Hub */
            <div>
              {urlError && (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '12px',
                    padding: '12px',
                    color: '#991b1b',
                    fontSize: '13px',
                    marginBottom: '20px',
                  }}
                >
                  ⚠️ {decodeURIComponent(urlMessage || urlError)}
                </div>
              )}

              {isSuccess && (
                <div
                  style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '12px',
                    padding: '14px 18px',
                    color: '#166534',
                    fontSize: '13.5px',
                    fontWeight: 600,
                    marginBottom: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>🎉</span> Accounts linked successfully to your brand!
                  </div>
                  <a
                    href="/channels"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '8px 16px',
                      background: '#16a34a',
                      color: '#ffffff',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '13px',
                      textDecoration: 'none',
                      width: 'fit-content',
                    }}
                  >
                    Return to VS Adda Channels →
                  </a>
                </div>
              )}

              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>
                Connect Social Media Channels
              </h2>
              <p style={{ fontSize: '13.5px', color: '#64748b', lineHeight: 1.5, margin: '0 0 20px 0' }}>
                Link your official brand channels below. <strong>You never share your personal password</strong> with {agencyName}.
              </p>

              {/* Security Banner */}
              <div
                style={{
                  background: 'rgba(79, 70, 229, 0.05)',
                  border: '1px solid rgba(79, 70, 229, 0.15)',
                  borderRadius: '14px',
                  padding: '12px 14px',
                  fontSize: '12.5px',
                  color: '#4338ca',
                  lineHeight: 1.45,
                  marginBottom: '22px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                }}
              >
                <span style={{ fontSize: '16px', lineHeight: 1 }}>🛡️</span>
                <span>
                  <strong>Client Security Guarantee:</strong> Tokens are encrypted with AES-256-GCM. Your agency receives publishing &amp; analytics access only. Your login password is 100% private.
                </span>
              </div>

              {/* Currently Connected Channels Pill List */}
              {existingChannels.length > 0 && (
                <div style={{ marginBottom: '22px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                    Currently Connected ({existingChannels.length}):
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {existingChannels.map((ch) => (
                      <div
                        key={ch.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderRadius: '10px',
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px rgba(34, 197, 94, 0.6)' }} />
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <NetworkIcon network={ch.network} className="w-4 h-4" />
                            <strong style={{ fontSize: '13px', color: '#0f172a' }}>{ch.network}</strong>
                          </div>
                          <span style={{ fontSize: '12.5px', color: '#64748b', fontFamily: 'monospace' }}>
                            {ch.handle}
                          </span>
                        </div>
                        <span style={{ fontSize: '11.5px', color: '#16a34a', fontWeight: 700, background: '#dcfce7', padding: '2px 8px', borderRadius: '6px' }}>
                          Active
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Grid of All 8 Supported Platforms */}
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '10px' }}>
                Choose Platform to Connect:
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {SUPPORTED_NETWORKS.map((net) => {
                  const isConnected = existingChannels.some(
                    (ch) => ch.network.toUpperCase() === net.network.toUpperCase()
                  );
                  const connectedHandle = existingChannels.find(
                    (ch) => ch.network.toUpperCase() === net.network.toUpperCase()
                  )?.handle;

                  return (
                    <div
                      key={net.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 16px',
                        borderRadius: '14px',
                        border: isConnected ? '1.5px solid #bbf7d0' : '1px solid #e2e8f0',
                        background: isConnected ? 'rgba(240, 253, 244, 0.6)' : '#ffffff',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0, flex: 1, marginRight: '12px' }}>
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: net.color,
                            color: '#ffffff',
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <NetworkIcon network={net.network} className="w-4 h-4 text-white" />
                        </div>

                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <strong style={{ fontSize: '14px', color: '#0f172a' }}>{net.name}</strong>
                            {isConnected && (
                              <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700, background: '#dcfce7', padding: '1px 6px', borderRadius: '4px' }}>
                                Connected
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0', lineHeight: 1.35, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {isConnected ? `Linked as ${connectedHandle}` : net.description}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => openConnectModal(net)}
                        style={{
                          background: isConnected ? '#f1f5f9' : '#0f172a',
                          color: isConnected ? '#475569' : '#ffffff',
                          border: 'none',
                          borderRadius: '10px',
                          padding: '8px 14px',
                          fontSize: '12.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          transition: 'transform 0.1s ease',
                        }}
                      >
                        {isConnected ? 'Update' : 'Connect'}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div style={{ marginTop: '24px', textAlign: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Connected channels will appear instantly in {agencyName}&apos;s dashboard.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Self-Serve Zero-Password Connection Dialog */}
      {activeModalNet && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'grid',
            placeItems: 'center',
            padding: '16px',
          }}
          onClick={() => setActiveModalNet(null)}
        >
          <div
            style={{
              maxWidth: '460px',
              width: '100%',
              background: '#ffffff',
              borderRadius: '20px',
              boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.3)',
              overflow: 'hidden',
              border: '1px solid rgba(226, 232, 240, 0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: activeModalNet.color,
                    color: '#ffffff',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <NetworkIcon network={activeModalNet.network} className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    Connect {activeModalNet.name}
                  </h3>
                  <span style={{ fontSize: '11.5px', color: '#64748b' }}>For {brand?.name}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveModalNet(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '20px',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '20px' }}>
              {feedbackMessage ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '24px 0',
                    fontSize: '15px',
                    color: '#16a34a',
                    fontWeight: 700,
                  }}
                >
                  {feedbackMessage}
                </div>
              ) : (
                <>
                  {/* Meta 1-Click Option (If Facebook or Instagram) */}
                  {(activeModalNet.id === 'facebook' || activeModalNet.id === 'instagram') && (
                    <div style={{ marginBottom: '18px' }}>
                      <button
                        type="button"
                        onClick={handleConnectMeta}
                        style={{
                          width: '100%',
                          background: '#1877F2',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '12px',
                          padding: '12px',
                          fontSize: '14px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          boxShadow: '0 4px 12px rgba(24, 119, 242, 0.25)',
                        }}
                      >
                        <NetworkIcon network="FACEBOOK" className="w-4 h-4 text-white" />
                        1-Click Meta (Facebook &amp; Instagram) OAuth
                      </button>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          margin: '16px 0 12px 0',
                          color: '#94a3b8',
                          fontSize: '12px',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                        }}
                      >
                        <span style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                        <span>OR CONNECT MANUALLY BELOW</span>
                        <span style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                      </div>
                    </div>
                  )}

                  {/* Scopes description */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                      Permissions Granted:
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12.5px', color: '#64748b', lineHeight: 1.5 }}>
                      {activeModalNet.scopes.map((s, idx) => (
                        <li key={idx}>{s}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Manual / Direct Handle Form */}
                  <form onSubmit={handleConfirmChannelConnect}>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                        {activeModalNet.name} Handle / Page Name:
                      </label>
                      <input
                        type="text"
                        required
                        value={customHandle}
                        onChange={(e) => setCustomHandle(e.target.value)}
                        placeholder={`e.g. ${activeModalNet.defaultPrefix}mybrand`}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: '10px',
                          border: '1.5px solid #cbd5e1',
                          fontSize: '14px',
                          color: '#0f172a',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                      <span style={{ display: 'block', fontSize: '11.5px', color: '#94a3b8', marginTop: '4px' }}>
                        🔒 Password is never requested or shared.
                      </span>
                    </div>

                    <button
                      type="submit"
                      disabled={isConnectingChannel || !customHandle.trim()}
                      style={{
                        width: '100%',
                        background: '#0f172a',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '13px',
                        fontSize: '14px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        opacity: isConnectingChannel || !customHandle.trim() ? 0.7 : 1,
                      }}
                    >
                      {isConnectingChannel ? 'Connecting Account...' : `Confirm & Connect ${activeModalNet.name}`}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
