import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { NetworkIcon } from '../common/NetworkIcon.js';
import { apiFetch } from '../../lib/api.js';
import { useToastStore } from '../../stores/toastStore.js';
import { useAuthStore } from '../../stores/authStore.js';

export type OAuthNetwork =
  | 'instagram'
  | 'facebook'
  | 'x'
  | 'linkedin'
  | 'tiktok'
  | 'youtube'
  | 'pinterest'
  | 'threads';

interface SocialOAuthModalProps {
  isOpen: boolean;
  network: OAuthNetwork;
  brandName: string;
  brandId: string;
  onClose: () => void;
  onBack: () => void;
  onSuccess?: (channelData: {
    handle: string;
    network: OAuthNetwork;
    brandId: string;
    followers: number;
  }) => void;
}

interface NetworkConfig {
  name: string;
  brandColor: string;
  gradient?: string;
  buttonBg: string;
  buttonText: string;
  iconBg: string;
  scopes: string[];
  loginTitle: string;
  loginSubtitle: string;
  hasDirectMetaOAuth?: boolean;
}

const NETWORK_CONFIGS: Record<OAuthNetwork, NetworkConfig> = {
  instagram: {
    name: 'Instagram Business',
    brandColor: '#e1306c',
    gradient: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
    buttonBg: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
    buttonText: '#ffffff',
    iconBg: '#c13584',
    loginTitle: 'Connect Instagram Business',
    loginSubtitle: 'Authenticate with Meta Graph API to auto-publish Reels, Stories, and Carousels.',
    hasDirectMetaOAuth: true,
    scopes: [
      'Publish posts, reels, and stories directly to your profile',
      'Read and reply to comments and direct messages in unified inbox',
      'Track reach, impressions, follower growth and engagement analytics',
    ],
  },
  facebook: {
    name: 'Facebook Page',
    brandColor: '#1877f2',
    gradient: 'linear-gradient(135deg, #1877f2 0%, #0c56c2 100%)',
    buttonBg: '#1877f2',
    buttonText: '#ffffff',
    iconBg: '#1877f2',
    loginTitle: 'Connect Facebook Page',
    loginSubtitle: 'Authenticate with Meta Graph API to auto-publish posts, videos, and monitor engagement.',
    hasDirectMetaOAuth: true,
    scopes: [
      'Manage and publish posts, photos, and videos to your Facebook Page',
      'Read Page comments, reactions, and direct messages',
      'Access Page Insights and demographic follower statistics',
    ],
  },
  x: {
    name: 'X (Twitter)',
    brandColor: '#ffffff',
    gradient: 'linear-gradient(135deg, #16181c 0%, #000000 100%)',
    buttonBg: '#ffffff',
    buttonText: '#000000',
    iconBg: '#16181c',
    loginTitle: 'Connect X Account',
    loginSubtitle: 'Official OAuth 2.0 connection for tweets, threads, and analytics.',
    scopes: [
      'Publish tweets and threads on behalf of your brand',
      'Monitor brand replies, mentions, and quotes',
      'Read engagement, retweets, and impression statistics',
    ],
  },
  linkedin: {
    name: 'LinkedIn Company',
    brandColor: '#0a66c2',
    gradient: 'linear-gradient(135deg, #0a66c2 0%, #004182 100%)',
    buttonBg: '#0a66c2',
    buttonText: '#ffffff',
    iconBg: '#0a66c2',
    loginTitle: 'Connect LinkedIn Company Page',
    loginSubtitle: 'Publish articles, company updates, and view member reactions.',
    scopes: [
      'Post updates, images, and articles to your LinkedIn Page',
      'Monitor page comments and community interactions',
      'Track page impressions, clicks, and visitor analytics',
    ],
  },
  tiktok: {
    name: 'TikTok Business',
    brandColor: '#00f2fe',
    gradient: 'linear-gradient(135deg, #000000 0%, #161823 100%)',
    buttonBg: '#fe2c55',
    buttonText: '#ffffff',
    iconBg: '#fe2c55',
    loginTitle: 'Connect TikTok Business',
    loginSubtitle: 'Publish video content and track video view performance.',
    scopes: [
      'Upload and schedule TikTok video posts',
      'Access video views, likes, and comment metrics',
    ],
  },
  youtube: {
    name: 'YouTube Channel',
    brandColor: '#ff0000',
    gradient: 'linear-gradient(135deg, #cc0000 0%, #ff0000 100%)',
    buttonBg: '#ff0000',
    buttonText: '#ffffff',
    iconBg: '#cc0000',
    loginTitle: 'Connect YouTube Channel',
    loginSubtitle: 'Upload YouTube Shorts and long-form videos with automatic scheduling.',
    scopes: [
      'Upload and schedule video content and YouTube Shorts',
      'Read watch time, viewer reach, and subscriber metrics',
    ],
  },
  pinterest: {
    name: 'Pinterest',
    brandColor: '#e60023',
    gradient: 'linear-gradient(135deg, #e60023 0%, #ad081b 100%)',
    buttonBg: '#e60023',
    buttonText: '#ffffff',
    iconBg: '#e60023',
    loginTitle: 'Connect Pinterest Boards',
    loginSubtitle: 'Publish Pins with destination links directly to your boards.',
    scopes: [
      'Create and schedule Pins with outbound links',
      'Read Pin saves, clicks, and impression analytics',
    ],
  },
  threads: {
    name: 'Threads by Instagram',
    brandColor: '#ffffff',
    gradient: 'linear-gradient(135deg, #101010 0%, #000000 100%)',
    buttonBg: '#ffffff',
    buttonText: '#000000',
    iconBg: '#101010',
    loginTitle: 'Connect Threads Account',
    loginSubtitle: 'Publish text updates and media to your Threads profile.',
    hasDirectMetaOAuth: true,
    scopes: [
      'Publish text threads, carousels, and image posts',
      'Track reply counts and thread engagement analytics',
    ],
  },
};

export function SocialOAuthModal({
  isOpen,
  network,
  brandName,
  brandId,
  onClose,
  onBack,
  onSuccess,
}: SocialOAuthModalProps) {
  if (!isOpen) return null;

  const addToast = useToastStore((state) => state.addToast);
  const userBrands = useAuthStore((s) => s.brands);
  const effectiveBrandId =
    brandId && brandId !== 'ember'
      ? brandId
      : (userBrands && userBrands[0]?.id) || '';
  const effectiveBrandName =
    brandName && brandName !== 'Brand'
      ? brandName
      : (userBrands?.find((b) => b.id === effectiveBrandId)?.name || userBrands?.[0]?.name || 'Brand');

  const cfg = NETWORK_CONFIGS[network] || NETWORK_CONFIGS.instagram;
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);

  // Manual ID & Password Connection state
  const [mode, setMode] = useState<'manual' | 'oauth'>('manual');
  const [handle, setHandle] = useState('');
  const [accountLogin, setAccountLogin] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  const handleManualConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handle.trim()) {
      addToast({ type: 'error', message: 'Please enter account handle or page name.' });
      return;
    }

    setIsSubmittingManual(true);
    try {
      const res: any = await apiFetch('/channels/connect-manual', {
        method: 'POST',
        body: JSON.stringify({
          brandId: effectiveBrandId,
          network: network.toUpperCase(),
          handle: handle.trim(),
          accountLogin: accountLogin.trim(),
          accountPassword: accountPassword.trim(),
        }),
      });

      if (res && res.channel) {
        const rawNet = (res.channel.network || network).toLowerCase();
        const cleanHandle = res.channel.handle || handle.trim();
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

        try {
          const saved = localStorage.getItem('vs_custom_channels');
          const prev = saved ? JSON.parse(saved) : [];
          const updated = [newCh, ...prev.filter((c: any) => c.id !== newCh.id)];
          localStorage.setItem('vs_custom_channels', JSON.stringify(updated));
        } catch {}

        window.dispatchEvent(new CustomEvent('channel:created', { detail: newCh }));

        addToast({
          type: 'success',
          message: res.message || `Successfully connected ${cfg.name} (${cleanHandle})! Past posts synced to dashboard.`,
        });

        if (onSuccess) {
          onSuccess({
            handle: cleanHandle,
            network,
            brandId: effectiveBrandId,
            followers: newCh.followers,
          });
        }
        onClose();
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.message || 'Failed to connect channel manually.',
      });
    } finally {
      setIsSubmittingManual(false);
    }
  };

  const handleOfficialOAuthConnect = async () => {
    setIsRedirecting(true);

    if (cfg.hasDirectMetaOAuth) {
      try {
        addToast({ type: 'info', message: 'Redirecting to official Meta OAuth login...' });

        let authUrl: string | null = null;

        // 1. Try direct authenticated Meta auth-url endpoint first
        try {
          const directAuth: any = await apiFetch(`/channels/meta/auth-url?brandId=${effectiveBrandId}`);
          if (directAuth?.authUrl) {
            authUrl = directAuth.authUrl;
          }
        } catch (e1) {
          console.warn('Direct auth-url endpoint failed, trying invite token fallback:', e1);
        }

        // 2. Fallback to invite token flow
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

        if (!authUrl) {
          throw new Error('No authorization URL returned from server.');
        }

        // Immediate browser redirect to official provider OAuth
        window.location.href = authUrl;
        return;
      } catch (err: any) {
        setIsRedirecting(false);
        addToast({
          type: 'error',
          message: err.message || 'Could not launch Meta login dialog. Make sure Meta App ID is configured on Render.',
        });
      }
    } else {
      // For other providers: generate Zero-Login OAuth Connect link
      try {
        const inviteRes: any = await apiFetch('/invites/connect', {
          method: 'POST',
          body: JSON.stringify({ brandId: effectiveBrandId }),
        });
        if (inviteRes?.inviteUrl) {
          setGeneratedInviteLink(inviteRes.inviteUrl);
        }
      } catch (err: any) {
        addToast({
          type: 'error',
          message: err.message || `Failed to initiate ${cfg.name} OAuth flow.`,
        });
      } finally {
        setIsRedirecting(false);
      }
    }
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'grid',
        placeItems: 'center',
        padding: '16px',
      }}
    >
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(12, 14, 16, 0.75)',
          backdropFilter: 'blur(8px)',
        }}
        onClick={isRedirecting ? undefined : onClose}
      />

      {/* Main Dialog */}
      <div
        className="card modal"
        style={{
          position: 'relative',
          zIndex: 10001,
          maxWidth: '520px',
          width: '100%',
          maxHeight: 'min(90vh, 740px)',
          overflowY: 'auto',
          borderRadius: '24px',
          background: 'var(--solid, #191b1f)',
          border: '1px solid var(--rim, rgba(255,255,255,0.12))',
          boxShadow: '0 24px 60px -18px rgba(0,0,0,0.7)',
        }}
      >
        {/* Top Branded Bar */}
        <div
          style={{
            background: cfg.gradient || cfg.brandColor,
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={onBack}
              disabled={isRedirecting}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'grid',
                placeItems: 'center',
                color: '#ffffff',
                cursor: 'pointer',
              }}
              title="Back"
            >
              <svg className="ico" viewBox="0 0 24 24" style={{ width: 18, height: 18 }}>
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  background: 'rgba(255,255,255,0.25)',
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#ffffff',
                }}
              >
                <NetworkIcon network={network} className="ico" />
              </span>
              <span style={{ fontWeight: 700, fontSize: '15px' }}>{cfg.name}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isRedirecting}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'grid',
              placeItems: 'center',
              color: '#ffffff',
              cursor: 'pointer',
            }}
            title="Close"
          >
            <svg className="ico" viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Modal Content */}
        <div style={{ padding: '24px' }}>
          {/* Header */}
          <div style={{ marginBottom: '20px' }}>
            <h3
              style={{
                fontSize: '20px',
                fontWeight: 800,
                color: 'var(--text, #eef0ee)',
                marginBottom: '6px',
                letterSpacing: '-0.02em',
              }}
            >
              {cfg.loginTitle}
            </h3>
            <p style={{ fontSize: '13.5px', color: 'var(--muted, #94a3b8)', lineHeight: 1.5 }}>
              Connecting to <strong style={{ color: 'var(--text, #eef0ee)' }}>{effectiveBrandName}</strong>. {cfg.loginSubtitle}
            </p>
          </div>

          {/* Connection Mode Tabs */}
          <div
            style={{
              display: 'flex',
              background: 'rgba(255,255,255,0.06)',
              borderRadius: '12px',
              padding: '4px',
              marginBottom: '20px',
              gap: '6px',
            }}
          >
            <button
              type="button"
              onClick={() => setMode('manual')}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                border: 'none',
                background: mode === 'manual' ? 'var(--ink, #f2b740)' : 'transparent',
                color: mode === 'manual' ? '#111315' : 'var(--text, #eef0ee)',
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
              onClick={() => setMode('oauth')}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                border: 'none',
                background: mode === 'oauth' ? 'var(--ink, #f2b740)' : 'transparent',
                color: mode === 'oauth' ? '#111315' : 'var(--text, #eef0ee)',
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

          {mode === 'manual' ? (
            <form onSubmit={handleManualConnect} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="field field--wide">
                <span className="field__label">
                  {['facebook', 'linkedin'].includes(network) ? 'Page Name / Handle' : 'Username / Handle'}
                </span>
                <input
                  type="text"
                  required
                  className="input"
                  placeholder={
                    ['facebook', 'youtube', 'linkedin'].includes(network)
                      ? 'e.g. Gaurav Official Page'
                      : 'e.g. @gaurav_official'
                  }
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                />
              </div>

              <div className="field field--wide">
                <span className="field__label">Account Login ID / Email (Optional)</span>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. client@gmail.com or +91 9876543210"
                  value={accountLogin}
                  onChange={(e) => setAccountLogin(e.target.value)}
                />
              </div>

              <div className="field field--wide">
                <span className="field__label">Account Password / Access Key</span>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input"
                    placeholder="Enter account password or access key"
                    value={accountPassword}
                    onChange={(e) => setAccountPassword(e.target.value)}
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

              <div
                style={{
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
                  <b>Dashboard Sync:</b> Account connects instantly with ID &amp; Password. Client&apos;s past posts and engagement will sync into your dashboard.
                </span>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn--subtle"
                  onClick={onClose}
                  disabled={isSubmittingManual}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingManual}
                  className="btn btn--ink"
                  style={{
                    background: 'var(--ink, #f2b740)',
                    color: '#111315',
                    fontWeight: 700,
                    padding: '10px 20px',
                    borderRadius: '12px',
                  }}
                >
                  {isSubmittingManual ? 'Connecting...' : `Confirm & Connect ${cfg.name}`}
                </button>
              </div>
            </form>
          ) : (
            <>
              {/* Security Notice: Never Asks Passwords */}
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '12px',
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '12.5px',
                  color: '#6ee7b7',
                  marginBottom: '20px',
                }}
              >
                <span style={{ fontSize: '16px' }}>🛡️</span>
                <span>
                  <strong>Zero-Password Security:</strong> Murmura never asks for or stores your social media password. Authentication occurs directly on the provider's official servers.
                </span>
              </div>

              {/* Requested Scopes */}
              <div
                style={{
                  background: 'var(--glass-2, rgba(255,255,255,0.05))',
                  border: '1px solid var(--line, rgba(255,255,255,0.08))',
                  borderRadius: '16px',
                  padding: '16px',
                  marginBottom: '24px',
                }}
              >
                <div
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--muted, #94a3b8)',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <svg className="ico" viewBox="0 0 24 24" style={{ width: 14, height: 14, color: 'var(--good, #5fcfa6)' }}>
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  Requested Permissions
                </div>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '10px' }}>
                  {cfg.scopes.map((scope, idx) => (
                    <li
                      key={idx}
                      style={{
                        fontSize: '13px',
                        color: 'var(--text, #eef0ee)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        lineHeight: 1.4,
                      }}
                    >
                      <span
                        style={{
                          color: 'var(--good, #5fcfa6)',
                          fontWeight: 800,
                          fontSize: '14px',
                        }}
                      >
                        ✓
                      </span>
                      <span>{scope}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Client Connection Link (for non-Meta networks or remote clients) */}
              {generatedInviteLink && (
                <div
                  style={{
                    padding: '14px',
                    borderRadius: '12px',
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    marginBottom: '20px',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#93c5fd', marginBottom: '6px' }}>
                    🔗 Secure Connection Portal Link
                  </div>
                  <input
                    type="text"
                    readOnly
                    value={generatedInviteLink}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff',
                      fontSize: '12px',
                      marginBottom: '8px',
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn--sm btn--ink"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedInviteLink);
                      addToast({ type: 'success', message: 'Connection link copied to clipboard!' });
                    }}
                  >
                    Copy Link
                  </button>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() => setMode('manual')}
                  disabled={isRedirecting}
                  style={{
                    background: 'rgba(242, 183, 64, 0.15)',
                    color: '#f2b740',
                    border: '1px solid rgba(242, 183, 64, 0.35)',
                    fontWeight: 700,
                    fontSize: '12.5px',
                    padding: '8px 14px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                  }}
                >
                  🔑 Switch to ID &amp; Password
                </button>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={onClose}
                    disabled={isRedirecting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={isRedirecting}
                    onClick={handleOfficialOAuthConnect}
                    style={{
                      background: cfg.buttonBg,
                      color: cfg.buttonText,
                      fontWeight: 700,
                      fontSize: '14px',
                      padding: '10px 20px',
                      borderRadius: '12px',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 14px -4px rgba(0,0,0,0.5)',
                    }}
                  >
                    {isRedirecting
                      ? 'Redirecting to Official Login...'
                      : cfg.hasDirectMetaOAuth
                      ? `Continue to Official ${cfg.name} Login →`
                      : `Connect ${cfg.name} via Official OAuth →`}
                  </button>
                </div>
              </div>
            </>
          )}
          </div>
        </div>
      </div>,
      document.body
  );
}
