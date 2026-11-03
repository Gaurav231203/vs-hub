import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { apiFetch } from '../../lib/api.js';
import { useAuthStore } from '../../stores/authStore.js';
import { useToastStore } from '../../stores/toastStore.js';

interface NewBrandModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (brand: any) => void;
}

const COMMON_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (US & Canada) · New York' },
  { value: 'America/Chicago', label: 'Central Time (US & Canada) · Chicago' },
  { value: 'America/Denver', label: 'Mountain Time (US & Canada) · Denver' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada) · Los Angeles' },
  { value: 'Europe/London', label: 'London, Edinburgh · GMT/BST' },
  { value: 'Europe/Paris', label: 'Paris, Berlin, Amsterdam · CET' },
  { value: 'Asia/Kolkata', label: 'India Standard Time · Mumbai, New Delhi' },
  { value: 'Asia/Dubai', label: 'Gulf Standard Time · Dubai' },
  { value: 'Asia/Singapore', label: 'Singapore, Hong Kong · SGT' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time · Tokyo' },
  { value: 'Australia/Sydney', label: 'Australian Eastern · Sydney, Melbourne' },
  { value: 'UTC', label: 'Coordinated Universal Time · UTC' },
];

const PRESET_COLORS = [
  '#4F46E5', // Indigo
  '#e06b53', // Coral
  '#f2b740', // Butter / Amber
  '#2d7a5b', // Pine / Emerald
  '#3b82f6', // Sea / Blue
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#0f172a', // Midnight / Ink
];

export function NewBrandModal({ isOpen, onClose, onCreated }: NewBrandModalProps) {
  const addToast = useToastStore((s) => s.addToast);
  const addBrandToStore = useAuthStore((s) => s.addBrand);

  const [name, setName] = useState('');
  const [clientContactName, setClientContactName] = useState('');
  const [clientContactEmail, setClientContactEmail] = useState('');
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  );
  const [color, setColor] = useState('#4F46E5');
  const [phone, setPhone] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [description, setDescription] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdInvite, setCreatedInvite] = useState<{
    inviteUrl: string;
    rawToken: string;
    brandName: string;
    brandId: string;
    contactEmail: string;
    contactName: string;
    contactPhone?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [whatsappSent, setWhatsappSent] = useState(false);

  const [inlinePhone, setInlinePhone] = useState('');

  const getWhatsAppUrlForPhone = (phoneNum?: string) => {
    const raw = phoneNum || createdInvite?.contactPhone || inlinePhone;
    if (!raw) return null;
    let clean = raw.replace(/\D/g, '');
    if (clean.length === 10) {
      clean = `91${clean}`;
    }
    const name = createdInvite?.contactName || 'there';
    const brand = createdInvite?.brandName || 'your brand';
    const link = createdInvite?.inviteUrl || '';
    const message = `Hi ${name}! 👋\n\nHere is your official connection link to connect the Facebook & Instagram accounts for *${brand}*:\n\n👉 ${link}\n\n🔒 This is a secure zero-login link. No agency password needed.`;
    return `https://api.whatsapp.com/send?phone=${clean}&text=${encodeURIComponent(message)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !clientContactName.trim() || !clientContactEmail.trim() || !timezone.trim()) {
      addToast({ type: 'error', message: 'Please fill in all required fields.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch('/brands', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          clientContactName: clientContactName.trim(),
          clientContactEmail: clientContactEmail.trim(),
          timezone,
          color,
          phone: phone.trim() || undefined,
          logoUrl: logoUrl.trim() || undefined,
          description: description.trim() || undefined,
        }),
      });

      const newBrand = res.brand;
      addBrandToStore({
        id: newBrand.id,
        name: newBrand.name,
        color: newBrand.color || color,
        description: newBrand.description,
        logoUrl: newBrand.logoUrl,
      });

      setCreatedInvite({
        inviteUrl: res.invite.inviteUrl,
        rawToken: res.invite.rawToken,
        brandName: newBrand.name,
        brandId: newBrand.id,
        contactEmail: res.contact.email,
        contactName: clientContactName.trim(),
        contactPhone: phone.trim() || res.contact.phone || undefined,
      });

      addToast({
        type: 'success',
        message: `Brand "${newBrand.name}" created and onboarding invite sent!`,
      });

      if (onCreated) {
        onCreated(newBrand);
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.message || 'Failed to create brand. Please check inputs and try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (!createdInvite?.inviteUrl) return;
    navigator.clipboard.writeText(createdInvite.inviteUrl);
    setCopied(true);
    addToast({ type: 'success', message: 'Invite link copied to clipboard!' });
    setTimeout(() => setCopied(false), 2500);
  };

  const handleClose = () => {
    setName('');
    setClientContactName('');
    setClientContactEmail('');
    setPhone('');
    setLogoUrl('');
    setDescription('');
    setCreatedInvite(null);
    setCopied(false);
    setWhatsappSent(false);
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
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
          background: 'rgba(15, 18, 22, 0.65)',
          backdropFilter: 'blur(8px)',
        }}
        onClick={handleClose}
      />

      {/* Modal Dialog */}
      <div
        className="modal card"
        style={{
          position: 'relative',
          zIndex: 100000,
          maxWidth: '560px',
          width: 'min(560px, calc(100vw - 24px))',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--float, #fdfdfb)',
          color: 'var(--text, #16191d)',
          borderRadius: '24px',
          boxShadow: 'var(--shadow-pop)',
          border: '1px solid var(--rim, var(--line, rgba(22, 26, 30, 0.15)))',
          padding: 'clamp(16px, 4vw, 28px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {createdInvite ? (
          /* Success & Delivery Confirmation State */
          <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
            {/* Animated Pulsing Emerald Success Icon */}
            <div
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                background: 'rgba(34, 197, 94, 0.12)',
                border: '2px solid rgba(34, 197, 94, 0.28)',
                color: '#22c55e',
                display: 'grid',
                placeItems: 'center',
                margin: '0 auto 16px',
                boxShadow: '0 0 24px -4px rgba(34, 197, 94, 0.35)',
              }}
            >
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>

            <h3 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--ink)' }}>
              Brand Created Successfully!
            </h3>
            <p style={{ fontSize: '13.5px', color: 'var(--muted)', margin: '0 0 20px 0' }}>
              Automated onboarding invite is ready for <strong>{createdInvite.brandName}</strong>.
            </p>

            {/* Direct Connection Link Box (High-Contrast Theme-Aware Glass Container) */}
            <div
              style={{
                textAlign: 'left',
                background: 'var(--well)',
                border: '1px solid var(--line-2)',
                borderRadius: '18px',
                padding: '16px',
                marginBottom: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '6px',
                      background: 'var(--glass-2)',
                      border: '1px solid var(--line-2)',
                      display: 'grid',
                      placeItems: 'center',
                      color: 'var(--text)',
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                  </div>
                  <strong style={{ fontSize: '13px', color: 'var(--text)' }}>
                    Client Connection Link
                  </strong>
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: '999px',
                    background: 'rgba(34, 197, 94, 0.12)',
                    color: '#22c55e',
                    border: '1px solid rgba(34, 197, 94, 0.25)',
                  }}
                >
                  Zero-login · 7 Days Active
                </span>
              </div>

              {/* URL Field with Click-to-Select and Action Buttons */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'var(--solid)',
                  border: '1px solid var(--line-2)',
                  borderRadius: '12px',
                  padding: '5px 6px 5px 12px',
                }}
              >
                <input
                  type="text"
                  readOnly
                  value={createdInvite.inviteUrl}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: '12.5px',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--text)',
                    textOverflow: 'ellipsis',
                  }}
                />

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <a
                    href={createdInvite.inviteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open link in new tab"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      border: '1px solid var(--line-2)',
                      background: 'var(--glass-2)',
                      color: 'var(--muted)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--text)';
                      e.currentTarget.style.borderColor = 'var(--text)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--muted)';
                      e.currentTarget.style.borderColor = 'var(--line-2)';
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>

                  <button
                    type="button"
                    onClick={handleCopyLink}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 14px',
                      fontSize: '12px',
                      fontWeight: 700,
                      borderRadius: '8px',
                      border: copied ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid var(--line-2)',
                      background: copied ? 'rgba(34, 197, 94, 0.18)' : 'var(--pill)',
                      color: copied ? '#22c55e' : 'var(--on-pill)',
                      cursor: 'pointer',
                      transition: 'all 0.18s ease',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {copied ? (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        Copy Link
                      </>
                    )}
                  </button>
                </div>
              </div>

              <p style={{ fontSize: '11.5px', color: 'var(--muted)', margin: '8px 0 0 2px' }}>
                Secure token with zero agency password needed. Client connects Facebook & Instagram in 2 clicks.
              </p>
            </div>

            {/* Email Dispatch Confirmation Card */}
            <div
              style={{
                background: 'rgba(34, 197, 94, 0.07)',
                border: '1px solid rgba(34, 197, 94, 0.25)',
                borderRadius: '16px',
                padding: '14px 16px',
                textAlign: 'left',
                margin: '0 0 14px 0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px rgba(34, 197, 94, 0.6)' }} />
                  <strong style={{ fontSize: '13px', color: 'var(--text)' }}>
                    Emailed directly to client:
                  </strong>
                </div>
                <span style={{ fontSize: '12.5px', color: '#22c55e', fontWeight: 600, wordBreak: 'break-all' }}>
                  {createdInvite.contactEmail}
                </span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0, lineHeight: 1.45 }}>
                Invitation email has been dispatched via Brevo with direct onboarding steps.
              </p>
            </div>

            {/* WhatsApp Card */}
            <div
              style={{
                background: 'rgba(37, 211, 102, 0.08)',
                border: '1px solid rgba(37, 211, 102, 0.3)',
                borderRadius: '16px',
                padding: '14px 16px',
                textAlign: 'left',
                margin: '0 0 20px 0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#25D366">
                    <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86.174.086.275.073.376-.044.101-.116.433-.506.549-.68.116-.173.231-.145.39-.086s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.099.824zm-3.423-14.416c-6.627 0-12 5.373-12 12 0 2.159.57 4.184 1.564 5.938l-1.564 5.713 5.861-1.538c1.704.931 3.666 1.464 5.751 1.464 6.627 0 12-5.373 12-12 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  <strong style={{ fontSize: '13px', color: 'var(--text)' }}>
                    Send via WhatsApp
                  </strong>
                </div>
                {(createdInvite.contactPhone || inlinePhone) && (
                  <span style={{ fontSize: '12px', color: '#25D366', fontWeight: 600 }}>
                    {createdInvite.contactPhone || inlinePhone}
                  </span>
                )}
              </div>

              {createdInvite.contactPhone ? (
                <>
                  <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 10px 0', lineHeight: 1.45 }}>
                    Click below to open WhatsApp with the personalized connection link pre-filled for <strong>{createdInvite.contactName}</strong>.
                  </p>
                  <a
                    href={getWhatsAppUrlForPhone(createdInvite.contactPhone) || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setWhatsappSent(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      width: '100%',
                      background: '#25D366',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '13.5px',
                      borderRadius: '10px',
                      padding: '10px 16px',
                      textDecoration: 'none',
                      boxShadow: '0 3px 12px rgba(37, 211, 102, 0.3)',
                      transition: 'transform 0.15s ease, filter 0.15s ease',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.08)')}
                    onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86.174.086.275.073.376-.044.101-.116.433-.506.549-.68.116-.173.231-.145.39-.086s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.099.824zm-3.423-14.416c-6.627 0-12 5.373-12 12 0 2.159.57 4.184 1.564 5.938l-1.564 5.713 5.861-1.538c1.704.931 3.666 1.464 5.751 1.464 6.627 0 12-5.373 12-12 0-6.627-5.373-12-12-12z"/>
                    </svg>
                    <span>{whatsappSent ? '✓ WhatsApp Opened (Click to Open Again)' : 'Send Invite via WhatsApp'}</span>
                  </a>
                </>
              ) : (
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 10px 0', lineHeight: 1.45 }}>
                    Enter client's WhatsApp number to send them the connection link with 1 click:
                  </p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="tel"
                      placeholder="e.g. 7017853715 or +91..."
                      value={inlinePhone}
                      onChange={(e) => setInlinePhone(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        fontSize: '13px',
                        borderRadius: '10px',
                        border: '1px solid var(--line-2)',
                        background: 'var(--solid)',
                        color: 'var(--text)',
                        outline: 'none',
                      }}
                    />
                    <a
                      href={getWhatsAppUrlForPhone() || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setWhatsappSent(true)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        background: '#25D366',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '12.5px',
                        borderRadius: '10px',
                        padding: '8px 16px',
                        textDecoration: 'none',
                        cursor: inlinePhone.trim() ? 'pointer' : 'not-allowed',
                        opacity: inlinePhone.trim() ? 1 : 0.6,
                        pointerEvents: inlinePhone.trim() ? 'auto' : 'none',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Send WhatsApp
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Primary Action Button */}
            <button
              type="button"
              className="btn btn--ink"
              style={{
                width: '100%',
                padding: '13px',
                fontSize: '14.5px',
                fontWeight: 700,
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
              onClick={handleClose}
            >
              Done & Return to Workspace
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
        ) : (
          /* Form State */
          <form onSubmit={handleSubmit}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--ink, #161a1e)' }}>
                  Add New Brand
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted, #64748b)', margin: 0 }}>
                  Create client brand and generate automated social media onboarding invite.
                </p>
              </div>
              <button
                type="button"
                className="ibtn ibtn--sm"
                onClick={handleClose}
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Field Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Brand Name */}
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text, #161a1e)' }}>
                  Brand Name <span style={{ color: '#e06b53' }}>*</span>
                </span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Corp, Starlight Bakery"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    padding: '11px 14px',
                    borderRadius: '12px',
                    border: '1px solid var(--line-2, rgba(128, 128, 128, 0.25))',
                    background: 'var(--solid, #f6f7f4)',
                    color: 'var(--text, #16191d)',
                    fontSize: '14px',
                    outline: 'none',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                />
              </label>

              {/* Client Contact Row: Name + Email */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text, #161a1e)' }}>
                    Client Contact Name <span style={{ color: '#e06b53' }}>*</span>
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sarah Jenkins"
                    value={clientContactName}
                    onChange={(e) => setClientContactName(e.target.value)}
                    style={{
                      padding: '11px 14px',
                      borderRadius: '12px',
                      border: '1px solid var(--line-2, rgba(128, 128, 128, 0.25))',
                      background: 'var(--solid, #f6f7f4)',
                      color: 'var(--text, #16191d)',
                      fontSize: '14px',
                      outline: 'none',
                      width: '100%',
                      boxSizing: 'border-box',
                    }}
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text, #161a1e)' }}>
                    Client Email <span style={{ color: '#e06b53' }}>*</span>
                  </span>
                  <input
                    type="email"
                    required
                    placeholder="client@brand.com"
                    value={clientContactEmail}
                    onChange={(e) => setClientContactEmail(e.target.value)}
                    style={{
                      padding: '11px 14px',
                      borderRadius: '12px',
                      border: '1px solid var(--line-2, rgba(128, 128, 128, 0.25))',
                      background: 'var(--solid, #f6f7f4)',
                      color: 'var(--text, #16191d)',
                      fontSize: '14px',
                      outline: 'none',
                      width: '100%',
                      boxSizing: 'border-box',
                    }}
                  />
                </label>
              </div>

              {/* Timezone (Theme-adaptive contrast) */}
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text, #161a1e)' }}>
                  Timezone <span style={{ color: '#e06b53' }}>*</span>
                </span>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  style={{
                    padding: '11px 14px',
                    borderRadius: '12px',
                    border: '1px solid var(--line-2, rgba(128, 128, 128, 0.25))',
                    fontSize: '14px',
                    background: 'var(--solid, #f6f7f4)',
                    color: 'var(--text, #16191d)',
                    outline: 'none',
                    cursor: 'pointer',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  {COMMON_TIMEZONES.map((tz) => (
                    <option
                      key={tz.value}
                      value={tz.value}
                      style={{
                        background: 'var(--solid, #ffffff)',
                        color: 'var(--text, #16191d)',
                      }}
                    >
                      {tz.label} ({tz.value})
                    </option>
                  ))}
                </select>
              </label>

              {/* Brand Theme Color */}
              <div>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text, #161a1e)', display: 'block', marginBottom: '8px' }}>
                  Brand Color
                </span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {PRESET_COLORS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setColor(hex)}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: hex,
                        border: color === hex ? '3px solid var(--text, #161a1e)' : '2px solid rgba(255,255,255,0.4)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                      title={hex}
                    />
                  ))}
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    style={{
                      width: '32px',
                      height: '32px',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: 'transparent',
                    }}
                    title="Custom color"
                  />
                </div>
              </div>

              {/* Optional Phone & Logo URL */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--muted, #64748b)' }}>
                    Phone (Optional)
                  </span>
                  <input
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={{
                      padding: '11px 14px',
                      borderRadius: '12px',
                      border: '1px solid var(--line-2, rgba(128, 128, 128, 0.25))',
                      background: 'var(--solid, #f6f7f4)',
                      color: 'var(--text, #16191d)',
                      fontSize: '14px',
                      outline: 'none',
                      width: '100%',
                      boxSizing: 'border-box',
                    }}
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--muted, #64748b)' }}>
                    Logo URL (Optional)
                  </span>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    style={{
                      padding: '11px 14px',
                      borderRadius: '12px',
                      border: '1px solid var(--line-2, rgba(128, 128, 128, 0.25))',
                      background: 'var(--solid, #f6f7f4)',
                      color: 'var(--text, #16191d)',
                      fontSize: '14px',
                      outline: 'none',
                      width: '100%',
                      boxSizing: 'border-box',
                    }}
                  />
                </label>
              </div>
            </div>

            {/* Footer Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '28px', paddingTop: '16px', borderTop: '1px solid var(--line, rgba(22, 26, 30, 0.08))' }}>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn--ink"
                disabled={isSubmitting}
                style={{ minWidth: '140px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
              >
                {isSubmitting ? (
                  <>
                    <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.6s linear infinite' }} />
                    Creating...
                  </>
                ) : (
                  'Create & Invite'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
