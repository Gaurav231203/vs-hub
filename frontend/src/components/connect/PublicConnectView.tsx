import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000/api/v1';

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

  // Multi-page picker state
  const [candidates, setCandidates] = useState<PageCandidate[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string>('');
  const [isSubmittingPage, setIsSubmittingPage] = useState(false);
  const [isSuccess, setIsSuccess] = useState(urlStatus === 'success');

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
        const res = await fetch(`${API_BASE}/public/connect/${token}`);
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
        setExistingChannels(data.existingChannels || []);
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
          const res = await fetch(`${API_BASE}/public/connect/${token}/pages/${sessionId}`);
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
      const res = await fetch(`${API_BASE}/public/connect/${token}/oauth/meta`);
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

  // Action: Request New Link
  const handleRequestNewLink = async () => {
    if (!token) return;
    setIsRequestingNewLink(true);
    try {
      const res = await fetch(`${API_BASE}/public/connect/${token}/request-new-link`, {
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

  // Action: Confirm multi-page selection
  const handleConfirmSelectPage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPageId || !sessionId || !token) return;

    setIsSubmittingPage(true);
    try {
      const res = await fetch(`${API_BASE}/public/connect/${token}/select-page`, {
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
        padding: '24px 16px',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      {/* Brand Header & Card Container */}
      <div
        style={{
          maxWidth: '520px',
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
            padding: '16px clamp(14px, 4vw, 24px)',
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
                style={{ width: '38px', height: '38px', borderRadius: '10px', objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: brand?.color || '#4F46E5',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '15px',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                {brand?.name ? brand.name.slice(0, 2).toUpperCase() : 'VA'}
              </div>
            )}
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                {brand?.name || 'Social Connect'}
              </h2>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Managed by <strong>{agencyName}</strong>
              </span>
            </div>
          </div>

          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              background: '#f1f5f9',
              color: '#475569',
              padding: '4px 8px',
              borderRadius: '6px',
            }}
          >
            Zero Login
          </span>
        </div>

        {/* Content Body */}
        <div style={{ padding: 'clamp(20px, 5vw, 32px) clamp(16px, 4vw, 28px)' }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  border: '3px solid #e2e8f0',
                  borderTopColor: '#4F46E5',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  margin: '0 auto 16px',
                }}
              />
              <span style={{ fontSize: '14px', color: '#64748b' }}>Verifying secure connection link...</span>
            </div>
          ) : errorState ? (
            /* Requirement 5: Friendly Expired / Revoked Message + Request New Link */
            <div style={{ textAlign: 'center' }}>
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
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
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
          ) : isSuccess ? (
            /* Success State */
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: 'rgba(34, 197, 94, 0.12)',
                  color: '#16a34a',
                  display: 'grid',
                  placeItems: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>

              <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: '0 0 8px 0' }}>
                Accounts Connected!
              </h3>
              <p style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.5, margin: '0 0 24px 0' }}>
                Your Facebook Page and Instagram accounts have been linked to <strong>{brand?.name}</strong>.
                Your agency <strong>{agencyName}</strong> can now publish and manage scheduled posts.
              </p>

              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '14px',
                  fontSize: '13px',
                  color: '#475569',
                }}
              >
                🔒 Authorization tokens are encrypted with AES-256-GCM. You can safely close this browser window.
              </div>
            </div>
          ) : step === 'select-page' && candidates.length > 0 ? (
            /* Multi-Page Selection Screen */
            <form onSubmit={handleConfirmSelectPage}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0' }}>
                Select Your Facebook Page
              </h3>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 20px 0' }}>
                Multiple Facebook Pages were found under your Meta profile. Please choose which one belongs to <strong>{brand?.name}</strong>:
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
                      style={{ width: '16px', height: '16px' }}
                    />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', display: 'block' }}>
                        {cand.pageName}
                      </span>
                      {cand.instagram && (
                        <span style={{ fontSize: '12px', color: '#64748b' }}>
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
            /* Default: Step 1 Initial Connect Screen */
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

              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: '0 0 8px 0' }}>
                Connect Social Media Channels
              </h3>
              <p style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.5, margin: '0 0 24px 0' }}>
                Authenticate your Facebook Pages & Instagram Business accounts to allow <strong>{agencyName}</strong> to schedule and publish content for <strong>{brand?.name}</strong>.
              </p>

              {/* Connected channels preview if any */}
              {existingChannels.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '8px' }}>
                    Currently Connected:
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {existingChannels.map((ch) => (
                      <div
                        key={ch.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '13px',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          background: '#f8fafc',
                          color: '#334155',
                        }}
                      >
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} />
                        <strong>{ch.network}</strong>: {ch.handle}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleConnectMeta}
                style={{
                  width: '100%',
                  background: '#1877F2',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '14px',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  boxShadow: '0 4px 12px rgba(24, 119, 242, 0.25)',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
                Connect Facebook & Instagram
              </button>

              <p style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', margin: '16px 0 0 0', lineHeight: 1.4 }}>
                🔒 Zero agency login required. You retain full control over your social permissions.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
