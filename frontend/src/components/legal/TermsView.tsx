import React from 'react';
import { Link } from 'react-router-dom';

export function TermsView() {
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
          Terms of Service
        </h1>
        <p style={{ color: 'var(--muted, #94a3b8)', fontSize: '13px', marginBottom: '32px' }}>
          Last Updated: November 5, 2026 · Effective Immediately
        </p>

        <div style={{ display: 'grid', gap: '28px', lineHeight: 1.7, fontSize: '14.5px', color: '#d1d5db' }}>
          <section>
            <h2 style={{ fontSize: '19px', fontWeight: 700, color: '#f3f4f6', marginBottom: '10px' }}>
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing or using the VS Adda platform and services, you agree to be bound by these Terms of Service. If you are using the service on behalf of an organization or business, you represent that you have the authority to bind that entity.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '19px', fontWeight: 700, color: '#f3f4f6', marginBottom: '10px' }}>
              2. Description of Service
            </h2>
            <p>
              VS Adda is a social media management suite that enables users to schedule, manage, collaborate on, and publish social media content across connected third-party platforms, as well as analyze engagement metrics.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '19px', fontWeight: 700, color: '#f3f4f6', marginBottom: '10px' }}>
              3. Third-Party Platform Compliance
            </h2>
            <p>
              Our service integrates with third-party APIs including Meta (Facebook &amp; Instagram), X (Twitter), LinkedIn, TikTok, YouTube, and Pinterest. Your use of our service is also subject to the terms and policies of each applicable social network:
            </p>
            <ul style={{ paddingLeft: '20px', marginTop: '10px', display: 'grid', gap: '8px' }}>
              <li>Meta Platform Terms and Developer Policies</li>
              <li>X Developer Agreement and Policy</li>
              <li>LinkedIn API Terms of Use</li>
              <li>YouTube Terms of Service (and Google Privacy Policy)</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: '19px', fontWeight: 700, color: '#f3f4f6', marginBottom: '10px' }}>
              4. User Responsibilities &amp; Content
            </h2>
            <p>
              You are responsible for all content, text, media, and materials you post through VS Adda. You agree not to publish infringing, defamatory, illegal, or harmful content, or to violate any third-party intellectual property rights.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '19px', fontWeight: 700, color: '#f3f4f6', marginBottom: '10px' }}>
              5. Termination &amp; Cancellation
            </h2>
            <p>
              You may terminate your account or disconnect channels at any time. Upon termination, all your stored access credentials are automatically revoked and permanently deleted from our servers.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '19px', fontWeight: 700, color: '#f3f4f6', marginBottom: '10px' }}>
              6. Contact Information
            </h2>
            <p>
              For legal inquiries or assistance regarding these terms, please contact us at support@vsadda.com.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

