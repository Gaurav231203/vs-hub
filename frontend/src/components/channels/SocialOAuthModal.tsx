import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { NetworkIcon } from '../common/NetworkIcon.js';
import { apiFetch } from '../../lib/api.js';
import { useToastStore } from '../../stores/toastStore.js';

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
}: SocialOAuthModalProps) {
  if (!isOpen) return null;

  const addToast = useToastStore((state) => state.addToast);
  const cfg = NETWORK_CONFIGS[network] || NETWORK_CONFIGS.instagram;
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);

  const handleOfficialOAuthConnect = async () => {
    setIsRedirecting(true);

    if (cfg.hasDirectMetaOAuth) {
      try {
        addToast({ type: 'info', message: 'Generating official Meta OAuth session...' });
        const inviteRes: any = await apiFetch('/invites/connect', {
          method: 'POST',
          body: JSON.stringify({ brandId }),
        });

        if (inviteRes?.rawToken) {
          const authRes: any = await apiFetch(`/invites/${inviteRes.rawToken}/meta-auth`);
          if (authRes?.authUrl) {
            window.location.href = authRes.authUrl;
            return;
          }
        }
        throw new Error('No authorization URL returned from server.');
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
          body: JSON.stringify({ brandId }),
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
          maxWidth: '500px',
          width: '100%',
          borderRadius: '24px',
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
              Connecting to <strong style={{ color: 'var(--text, #eef0ee)' }}>{brandName}</strong>. {cfg.loginSubtitle}
            </p>
          </div>

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
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={onBack}
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
      </div>
    </div>,
    document.body
  );
}
