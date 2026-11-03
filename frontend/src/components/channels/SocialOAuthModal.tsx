import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { NetworkIcon } from '../common/NetworkIcon';

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
  onSuccess: (channelData: {
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
  defaultHandlePrefix: string;
  scopes: string[];
  loginTitle: string;
  loginSubtitle: string;
  allowCustomHandle: boolean;
}

const NETWORK_CONFIGS: Record<OAuthNetwork, NetworkConfig> = {
  instagram: {
    name: 'Instagram',
    brandColor: '#e1306c',
    gradient: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
    buttonBg: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
    buttonText: '#ffffff',
    iconBg: '#c13584',
    defaultHandlePrefix: '@',
    loginTitle: 'Log in with Instagram',
    loginSubtitle: 'Authorize Murmura to connect your Instagram Creator or Business account.',
    allowCustomHandle: true,
    scopes: [
      'Access basic profile info, media & follower metrics',
      'Publish posts, reels, and stories on your behalf',
      'Read and reply to direct messages and post comments',
      'View audience growth and performance insights',
    ],
  },
  facebook: {
    name: 'Facebook',
    brandColor: '#1877f2',
    gradient: 'linear-gradient(135deg, #1877f2 0%, #0c56c2 100%)',
    buttonBg: '#1877f2',
    buttonText: '#ffffff',
    iconBg: '#1877f2',
    defaultHandlePrefix: '',
    loginTitle: 'Log in with Facebook',
    loginSubtitle: 'Connect your Facebook Page to manage posts, inbox, and insights.',
    allowCustomHandle: true,
    scopes: [
      'Manage and publish posts, stories, and videos to your Page',
      'Read Page content, comments, and member messages',
      'Moderate visitor comments and engage as your Page',
      'Read Page Insights and demographic follower data',
    ],
  },
  x: {
    name: 'X (Twitter)',
    brandColor: '#ffffff',
    gradient: 'linear-gradient(135deg, #16181c 0%, #000000 100%)',
    buttonBg: '#ffffff',
    buttonText: '#000000',
    iconBg: '#16181c',
    defaultHandlePrefix: '@',
    loginTitle: 'Authorize Murmura on X',
    loginSubtitle: 'Allow Murmura to read and publish posts on your behalf.',
    allowCustomHandle: true,
    scopes: [
      'See your profile information and account settings',
      'See posts from your timeline and bookmarks',
      'Post, repost, and delete posts on your behalf',
      'Send and receive Direct Messages and review mentions',
    ],
  },
  linkedin: {
    name: 'LinkedIn',
    brandColor: '#0a66c2',
    gradient: 'linear-gradient(135deg, #0a66c2 0%, #004182 100%)',
    buttonBg: '#0a66c2',
    buttonText: '#ffffff',
    iconBg: '#0a66c2',
    defaultHandlePrefix: '',
    loginTitle: 'Sign in with LinkedIn',
    loginSubtitle: 'Authorize Murmura to access your LinkedIn Company Page.',
    allowCustomHandle: true,
    scopes: [
      'Publish company updates, articles, and video media',
      'Retrieve member comments and manage discussions',
      'Access company follower growth and page impressions',
      'Read organizational page analytics and lead forms',
    ],
  },
  tiktok: {
    name: 'TikTok',
    brandColor: '#fe2c55',
    gradient: 'linear-gradient(135deg, #010101 0%, #16181f 100%)',
    buttonBg: '#fe2c55',
    buttonText: '#ffffff',
    iconBg: '#010101',
    defaultHandlePrefix: '@',
    loginTitle: 'Log in to TikTok',
    loginSubtitle: 'Connect your TikTok for Business account with Murmura.',
    allowCustomHandle: true,
    scopes: [
      'Access your public profile info and video feed',
      'Upload and publish videos directly to TikTok',
      'Read video comments, likes, and engagement metrics',
      'Access audience demographic and viewer trends',
    ],
  },
  youtube: {
    name: 'YouTube',
    brandColor: '#ff0000',
    gradient: 'linear-gradient(135deg, #cc0000 0%, #ff0000 100%)',
    buttonBg: '#1a73e8', // Google Blue for Google Auth
    buttonText: '#ffffff',
    iconBg: '#ff0000',
    defaultHandlePrefix: '',
    loginTitle: 'Sign in with Google',
    loginSubtitle: 'Murmura wants to access your YouTube Channel and video library.',
    allowCustomHandle: true,
    scopes: [
      'Manage your YouTube videos and community posts',
      'View YouTube Analytics reports for your content',
      'Manage and reply to comments on your channel',
      'View subscriber growth and watch-time statistics',
    ],
  },
  pinterest: {
    name: 'Pinterest',
    brandColor: '#e60023',
    gradient: 'linear-gradient(135deg, #ad081b 0%, #e60023 100%)',
    buttonBg: '#e60023',
    buttonText: '#ffffff',
    iconBg: '#e60023',
    defaultHandlePrefix: '',
    loginTitle: 'Log in to Pinterest',
    loginSubtitle: 'Connect your Pinterest Business account and boards.',
    allowCustomHandle: true,
    scopes: [
      'Create, edit, and publish Pins and video Pins',
      'Organize and manage public boards',
      'Read Pin impressions, saves, and outbound clicks',
      'Access audience demographics and keyword trends',
    ],
  },
  threads: {
    name: 'Threads',
    brandColor: '#ffffff',
    gradient: 'linear-gradient(135deg, #101214 0%, #1f2226 100%)',
    buttonBg: '#ffffff',
    buttonText: '#101214',
    iconBg: '#16191d',
    defaultHandlePrefix: '@',
    loginTitle: 'Log in to Threads',
    loginSubtitle: 'Continue with Instagram to authorize posting and insights on Threads.',
    allowCustomHandle: true,
    scopes: [
      'Publish threads, quotes, and replies on your behalf',
      'Access profile information and thread feeds',
      'Retrieve follower engagement and reply chains',
      'View thread performance metrics and reach',
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

  const cfg = NETWORK_CONFIGS[network] || NETWORK_CONFIGS.instagram;
  const cleanBrand = brandName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'brand';

  const defaultHandle = cfg.defaultHandlePrefix
    ? `${cfg.defaultHandlePrefix}${cleanBrand}`
    : brandName;

  const [handle, setHandle] = useState(defaultHandle);
  const [password, setPassword] = useState('••••••••••••');
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [authStep, setAuthStep] = useState<string>('idle');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthorizing(true);
    setAuthStep('Authenticating with ' + cfg.name + ' OAuth 2.0...');

    setTimeout(() => {
      setAuthStep('Granting publishing & analytics scopes...');
      setTimeout(() => {
        setAuthStep('Finalizing connection & issuing tokens...');
        setTimeout(() => {
          setIsAuthorizing(false);
          const finalHandle = handle.trim() || defaultHandle;
          const followersCount = Math.floor(10000 + Math.random() * 55000);
          onSuccess({
            handle: finalHandle,
            network,
            brandId,
            followers: followersCount,
          });
        }, 600);
      }, 700);
    }, 600);
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
          background: 'rgba(12, 14, 16, 0.65)',
          backdropFilter: 'blur(8px)',
        }}
        onClick={isAuthorizing ? undefined : onClose}
      />

      {/* Main Dialog */}
      <div
        className="card modal"
        style={{
          position: 'relative',
          zIndex: 10001,
          maxWidth: '480px',
          width: '100%',
          borderRadius: '26px',
          overflow: 'hidden',
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
              disabled={isAuthorizing}
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
                transition: 'background 0.15s ease',
              }}
              title="Back to network selection"
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
            disabled={isAuthorizing}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '22px' }}>
          {/* Header Title */}
          <div style={{ marginBottom: '18px' }}>
            <h3
              style={{
                fontSize: '20px',
                fontWeight: 700,
                color: 'var(--text)',
                letterSpacing: '-0.02em',
                marginBottom: '4px',
              }}
            >
              {cfg.loginTitle}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.45 }}>
              Connecting to <strong style={{ color: 'var(--text)' }}>{brandName}</strong>. {cfg.loginSubtitle}
            </p>
          </div>

          {/* Social Media Login Inputs */}
          <div style={{ display: 'grid', gap: '14px', marginBottom: '18px' }}>
            <label className="field" style={{ gap: '6px' }}>
              <span className="field__label">
                {network === 'facebook'
                  ? 'Page Name or Handle'
                  : network === 'youtube'
                  ? 'Channel Name or Google Account'
                  : 'Account Handle or Username'}
              </span>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder={defaultHandle}
                  required
                  disabled={isAuthorizing}
                  style={{
                    background: 'var(--float, #1f2226)',
                    borderColor: 'var(--line-2, rgba(255,255,255,0.14))',
                    color: 'var(--text, #eef0ee)',
                    borderRadius: '14px',
                    width: '100%',
                    height: '44px',
                    padding: '0 14px',
                    fontSize: '14px',
                  }}
                />
              </div>
            </label>

            <label className="field" style={{ gap: '6px' }}>
              <span className="field__label">Password / Security Key</span>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                  disabled={isAuthorizing}
                  style={{
                    background: 'var(--float, #1f2226)',
                    borderColor: 'var(--line-2, rgba(255,255,255,0.14))',
                    color: 'var(--text, #eef0ee)',
                    borderRadius: '14px',
                    width: '100%',
                    height: '44px',
                    padding: '0 42px 0 14px',
                    fontSize: '14px',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--muted)',
                    cursor: 'pointer',
                    padding: '4px',
                  }}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  <svg className="ico" viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
                    {showPassword ? (
                      <>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    ) : (
                      <>
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </label>
          </div>

          {/* Requested Permissions Box */}
          <div
            style={{
              background: 'var(--glass-2, rgba(255,255,255,0.06))',
              border: '1px solid var(--line, rgba(255,255,255,0.08))',
              borderRadius: '16px',
              padding: '14px 16px',
              marginBottom: '20px',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--muted)',
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <svg className="ico" viewBox="0 0 24 24" style={{ width: 14, height: 14, color: 'var(--good)' }}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Requested Permissions
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '8px' }}>
              {cfg.scopes.map((scope, idx) => (
                <li
                  key={idx}
                  style={{
                    fontSize: '12.5px',
                    color: 'var(--text)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    lineHeight: 1.35,
                  }}
                >
                  <span
                    style={{
                      color: 'var(--good, #5fcfa6)',
                      fontWeight: 700,
                      marginTop: '1px',
                    }}
                  >
                    ✓
                  </span>
                  <span>{scope}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Authorizing Status Banner */}
          {isAuthorizing && (
            <div
              style={{
                padding: '12px 14px',
                marginBottom: '16px',
                borderRadius: '14px',
                background: 'rgba(17, 116, 90, 0.15)',
                border: '1px solid rgba(17, 116, 90, 0.3)',
                color: 'var(--good, #5fcfa6)',
                fontSize: '13px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid currentColor',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite',
                }}
              />
              <span>{authStep}</span>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={onBack}
              disabled={isAuthorizing}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn"
              disabled={isAuthorizing}
              style={{
                background: cfg.buttonBg,
                color: cfg.buttonText,
                fontWeight: 700,
                boxShadow: '0 4px 14px -4px rgba(0,0,0,0.4)',
                border: 'none',
              }}
            >
              {isAuthorizing ? 'Authorizing...' : `Log In & Connect ${cfg.name}`}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
