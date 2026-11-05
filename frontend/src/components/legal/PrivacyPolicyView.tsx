import React from 'react';
import { Link } from 'react-router-dom';

export function PrivacyPolicyView() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg, #111315)',
        color: 'var(--text, #eef0ee)',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        padding: '40px 20px',
      }}
    >
      <div
        style={{
          maxWidth: '840px',
          margin: '0 auto',
          background: 'var(--solid, #1a1d20)',
          border: '1px solid var(--rim, rgba(255,255,255,0.08))',
          borderRadius: '24px',
          padding: '48px 40px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        }}
      >
        {/* Navigation & Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'var(--ink, #f2b740)',
                color: '#111315',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 900,
                fontSize: '18px',
              }}
            >
              V
            </div>
            <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em' }}>VS Adda</span>
          </div>
          <Link
            to="/channels"
            style={{
              color: 'var(--ink, #f2b740)',
              textDecoration: 'none',
              fontSize: '13.5px',
              fontWeight: 600,
            }}
          >
            ← Back to Dashboard
          </Link>
        </div>

        <h1 style={{ fontSize: '32px', fontWeight: 900, marginBottom: '8px', letterSpacing: '-0.03em' }}>
          Privacy Policy
        </h1>
        <p style={{ color: 'var(--muted, #94a3b8)', fontSize: '13px', marginBottom: '32px' }}>
          Last Updated: November 5, 2026 · Effective Immediately
        </p>

        <div style={{ display: 'grid', gap: '28px', lineHeight: 1.7, fontSize: '14.5px', color: '#d1d5db' }}>
          <section>
            <h2 style={{ fontSize: '19px', fontWeight: 700, color: '#f3f4f6', marginBottom: '10px' }}>
              1. Overview &amp; Commitment
            </h2>
            <p>
              VS Adda (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) operates a social media management and publishing platform. We respect the privacy of our users and clients and are committed to protecting personal and business data. This Privacy Policy details our practices regarding data collection, usage, and security, specifically in connection with social media integrations including Meta (Facebook &amp; Instagram), X (Twitter), LinkedIn, TikTok, YouTube, and Pinterest.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '19px', fontWeight: 700, color: '#f3f4f6', marginBottom: '10px' }}>
              2. Zero-Password Security Architecture
            </h2>
            <p>
              <strong>We never request, store, or transmit your personal social media passwords.</strong> All social account connections are established using official OAuth 2.0 authorization protocols provided directly by third-party platforms (e.g. Meta Graph API). You authorize access on the provider&apos;s own secure dialog, and an encrypted access token is returned to our servers.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '19px', fontWeight: 700, color: '#f3f4f6', marginBottom: '10px' }}>
              3. Meta (Facebook &amp; Instagram) Data Usage &amp; Scopes
            </h2>
            <p>
              When you connect your Facebook Page or Instagram Business Account to VS Adda, we request specific scoped permissions to perform services you explicitly initiate:
            </p>
            <ul style={{ paddingLeft: '20px', marginTop: '10px', display: 'grid', gap: '8px' }}>
              <li>
                <strong>pages_show_list &amp; pages_read_engagement:</strong> Used to display the list of Facebook Pages you manage so you can select which page to link, and to measure post reach and reactions.
              </li>
              <li>
                <strong>pages_manage_posts:</strong> Used exclusively to publish posts, photos, and video media that you compose and approve within the VS Adda calendar or composer.
              </li>
              <li>
                <strong>instagram_basic &amp; instagram_content_publish:</strong> Used to publish authorized posts, reels, and carousels to linked Instagram Business accounts.
              </li>
            </ul>
            <p style={{ marginTop: '10px' }}>
              We do <strong>not</strong> sell, rent, or share your Meta data or Facebook Page information with any third parties or advertisers. Data is utilized strictly to provide social scheduling, analytics, and messaging services.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '19px', fontWeight: 700, color: '#f3f4f6', marginBottom: '10px' }}>
              4. Data Storage and AES-256 Encryption
            </h2>
            <p>
              All authorization credentials and access tokens are encrypted at rest using military-grade AES-256-GCM encryption with cryptographic initialization vectors. Database access is strictly restricted, multi-tenant isolated, and audited.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '19px', fontWeight: 700, color: '#f3f4f6', marginBottom: '10px' }}>
              5. User Data Deletion &amp; Revocation
            </h2>
            <p>
              You maintain complete control over your connected accounts at all times:
            </p>
            <ul style={{ paddingLeft: '20px', marginTop: '10px', display: 'grid', gap: '8px' }}>
              <li>
                <strong>Disconnecting from VS Adda:</strong> You can disconnect any channel at any time from the Channels dashboard. Upon disconnection, stored access tokens and channel records are permanently deleted from our database.
              </li>
              <li>
                <strong>Revoking via Facebook:</strong> You can revoke access at any time directly through your Facebook account under <em>Settings &amp; Privacy &gt; Settings &gt; Business Integrations / Apps and Websites</em>.
              </li>
              <li>
                <strong>Data Deletion Request:</strong> Visit our dedicated <Link to="/data-deletion" style={{ color: 'var(--ink, #f2b740)' }}>User Data Deletion page</Link> or email our privacy officer to request the immediate erasure of all your account data.
              </li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: '19px', fontWeight: 700, color: '#f3f4f6', marginBottom: '10px' }}>
              6. Contact Information
            </h2>
            <p>
              If you have any questions about this Privacy Policy, your data, or compliance, please contact us at:
            </p>
            <div
              style={{
                marginTop: '12px',
                padding: '16px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <p style={{ margin: 0, fontWeight: 600 }}>VS Adda Privacy Team</p>
              <p style={{ margin: '4px 0 0 0', color: 'var(--muted, #94a3b8)', fontSize: '13px' }}>
                Email: support@vsadda.com / washingtonjosh770@gmail.com
              </p>
              <p style={{ margin: '4px 0 0 0', color: 'var(--muted, #94a3b8)', fontSize: '13px' }}>
                Website: https://vs-hub-ruddy.vercel.app
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

