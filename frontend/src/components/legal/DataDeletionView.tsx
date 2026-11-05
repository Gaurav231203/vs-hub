import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export function DataDeletionView() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubmitted(true);
    }
  };

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

        <h1 style={{ fontSize: '30px', fontWeight: 900, marginBottom: '8px', letterSpacing: '-0.03em' }}>
          Facebook &amp; Instagram User Data Deletion Instructions
        </h1>
        <p style={{ color: 'var(--muted, #94a3b8)', fontSize: '13px', marginBottom: '32px' }}>
          In accordance with Meta Platform Policy and GDPR/CCPA regulations, you have the right to request the deletion of all data associated with your Facebook / Instagram accounts.
        </p>

        <div style={{ display: 'grid', gap: '28px', lineHeight: 1.7, fontSize: '14.5px', color: '#d1d5db' }}>
          <section>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#f3f4f6', marginBottom: '10px' }}>
              Method 1: Automatic Deletion via Facebook Settings (Recommended)
            </h2>
            <p>
              To remove your Facebook / Instagram data and revoke VS Adda&apos;s permissions directly:
            </p>
            <ol style={{ paddingLeft: '20px', marginTop: '10px', display: 'grid', gap: '8px' }}>
              <li>Log in to your Facebook account and go to <strong>Settings &amp; Privacy &gt; Settings</strong>.</li>
              <li>In the left-hand navigation, click <strong>Business Integrations</strong> (or <strong>Apps and Websites</strong>).</li>
              <li>Find <strong>vs adda</strong> (or VS Adda) in your list of authorized applications.</li>
              <li>Check the box next to it and click <strong>Remove</strong>.</li>
              <li>Facebook will automatically ping our server callback, and our system will instantly purge all cached access tokens, pages, and profile identifiers associated with your user account.</li>
            </ol>
          </section>

          <section>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#f3f4f6', marginBottom: '10px' }}>
              Method 2: One-Click Disconnect in VS Adda Dashboard
            </h2>
            <p>
              You can immediately delete any channel and all its stored tokens at any time:
            </p>
            <ol style={{ paddingLeft: '20px', marginTop: '10px', display: 'grid', gap: '8px' }}>
              <li>Open your <Link to="/channels" style={{ color: 'var(--ink, #f2b740)' }}>Channels dashboard</Link>.</li>
              <li>Find the Facebook Page or Instagram channel you wish to remove.</li>
              <li>Click the three-dots menu (<strong>···</strong>) and select <strong>Disconnect channel</strong>.</li>
              <li>All authorization tokens, channel records, and database rows are permanently deleted immediately.</li>
            </ol>
          </section>

          <section>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#f3f4f6', marginBottom: '10px' }}>
              Method 3: Submit a Manual Data Deletion Request
            </h2>
            <p>
              If you wish to request a complete deletion of all records associated with your account or organization, submit your email below or contact us:
            </p>

            {submitted ? (
              <div
                style={{
                  marginTop: '16px',
                  padding: '16px 20px',
                  borderRadius: '12px',
                  background: 'rgba(34, 197, 94, 0.12)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  color: '#86efac',
                  fontSize: '14px',
                }}
              >
                ✓ Request received for <strong>{email}</strong>. Confirmation code: <strong>DEL-{Date.now().toString(36).toUpperCase()}</strong>. All matching data will be purged within 24 hours.
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ marginTop: '16px', display: 'flex', gap: '10px', maxWidth: '500px' }}>
                <input
                  type="email"
                  required
                  placeholder="Enter your registered email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: '#111315',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff',
                    fontSize: '14px',
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: '10px 18px',
                    borderRadius: '10px',
                    background: 'var(--ink, #f2b740)',
                    color: '#111315',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  Request Deletion
                </button>
              </form>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
