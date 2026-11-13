import nodemailer from 'nodemailer';
import { logger } from './logger.js';
import { env, cleanEnvString } from '../config/env.js';

export interface SendInviteEmailParams {
  toEmail: string;
  clientName: string;
  brandName: string;
  agencyName: string;
  inviteUrl: string;
  expiresInDays?: number;
}

export interface SendReminderEmailParams {
  toEmail: string;
  clientName: string;
  brandName: string;
  agencyName: string;
  inviteUrl: string;
}

export interface SendRequestNewLinkNotificationParams {
  agencyAdminEmail: string;
  clientName?: string;
  clientEmail?: string;
  brandName: string;
}

export interface SendPostReviewEmailParams {
  toEmail: string;
  clientName?: string;
  brandName: string;
  agencyName: string;
  reviewUrl: string;
  postCaption?: string;
  scheduledAt?: Date | string | null;
  mediaThumbUrl?: string | null;
}

export interface EmailDeliveryResult {
  sent: boolean;
  provider: 'brevo_api' | 'resend_api' | 'smtp' | 'mock' | 'none';
  from?: string;
  to: string;
  messageId?: string;
  error?: string;
}

export interface EmailDiagnostics {
  brevoConfigured: boolean;
  brevoKeyPreview?: string;
  brevoAccountValid: boolean;
  brevoCredits?: number;
  brevoAccountError?: string;
  verifiedSenders: string[];
  configuredFrom: { name: string; email: string };
  smtpConfigured: boolean;
  resendConfigured: boolean;
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function parseFromAddress(raw: string): { name: string; email: string } {
  const cleaned = cleanEnvString(raw) || 'VS Adda <washingtonjosh770@gmail.com>';
  const bracketMatch = cleaned.match(/^(.*?)\s*<([^<>@\s]+@[^<>@\s]+\.[^<>@\s]+)>$/);
  if (bracketMatch) {
    const cleanName = cleanEnvString(bracketMatch[1]) || 'VS Adda';
    return { name: cleanName, email: bracketMatch[2].trim() };
  }
  const emailMatch = cleaned.match(/([^\s<>"']+@[^\s<>"']+\.[^\s<>"']+)/);
  if (emailMatch) {
    return { name: 'VS Adda', email: emailMatch[1].trim() };
  }
  return { name: 'VS Adda', email: 'washingtonjosh770@gmail.com' };
}

function readRuntimeEnv(key: keyof typeof env, fallback = ''): string {
  if (Object.prototype.hasOwnProperty.call(process.env, key) && process.env[key] !== undefined) {
    return cleanEnvString(process.env[key]) ?? fallback;
  }
  return cleanEnvString((env as any)[key]) ?? fallback;
}

export class EmailService {
  /**
   * Send social connect onboarding invite to brand client
   */
  static async sendConnectInvite(params: SendInviteEmailParams): Promise<EmailDeliveryResult> {
    const { toEmail, clientName, brandName, agencyName, inviteUrl, expiresInDays = 7 } = params;

    const safeBrand = escapeHtml(brandName);
    const safeAgency = escapeHtml(agencyName);
    const safeClient = escapeHtml(clientName || 'there');

    const subject = `Connect social media accounts for ${brandName} · ${agencyName}`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; color: #161a1e; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
        <div style="margin-bottom: 24px;">
          <h2 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: #111827;">Connect Social Channels</h2>
          <p style="margin: 0; color: #4b5563; font-size: 14px;"><strong>${safeAgency}</strong> has invited you to connect the official social media accounts for <strong>${safeBrand}</strong>.</p>
        </div>

        <p style="font-size: 14px; line-height: 1.6; color: #374151;">Hi ${safeClient},</p>
        <p style="font-size: 14px; line-height: 1.6; color: #374151;">To allow ${safeAgency} to manage, schedule, and publish posts on behalf of ${safeBrand}, please click the secure link below to link your Facebook & Instagram pages. No agency account or password required.</p>

        <div style="margin: 32px 0; text-align: center;">
          <a href="${inviteUrl}" target="_blank" style="display: inline-block; background: #161a1e; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
            Connect ${safeBrand} Accounts →
          </a>
        </div>

        <p style="font-size: 12px; color: #6b7280; line-height: 1.5; margin-top: 24px; border-top: 1px solid #f3f4f6; padding-top: 16px;">
          🔒 This is a secure zero-login link valid for ${expiresInDays} days.<br/>
          If the button above does not work, copy and paste this URL into your browser:<br/>
          <a href="${inviteUrl}" style="color: #4f46e5; word-break: break-all;">${inviteUrl}</a>
        </p>
      </div>
    `;

    return this.dispatchEmail({ to: toEmail, subject, html });
  }

  /**
   * Send post sign-off review request with live preview button to brand client
   */
  static async sendPostReviewInvite(params: SendPostReviewEmailParams): Promise<EmailDeliveryResult> {
    const { toEmail, clientName, brandName, agencyName, reviewUrl, postCaption, scheduledAt, mediaThumbUrl } = params;

    const safeBrand = escapeHtml(brandName);
    const safeAgency = escapeHtml(agencyName);
    const safeClient = escapeHtml(clientName || 'there');
    const safeCaption = postCaption ? escapeHtml(postCaption.slice(0, 300)) : '';

    const scheduledTimeStr = scheduledAt
      ? new Date(scheduledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
      : 'Ready for scheduling';

    const subject = `Review & Sign-Off Request: New Post for ${brandName} · ${agencyName}`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; color: #161a1e; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
        <div style="margin-bottom: 24px; border-bottom: 1px solid #f3f4f6; padding-bottom: 16px;">
          <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #d97706; background: #fef3c7; padding: 4px 8px; border-radius: 6px;">Sign-Off Needed</span>
          <h2 style="margin: 12px 0 4px 0; font-size: 20px; font-weight: 700; color: #111827;">New Post Ready for Review</h2>
          <p style="margin: 0; color: #6b7280; font-size: 13px;"><strong>${safeAgency}</strong> has prepared a new social post for <strong>${safeBrand}</strong>.</p>
        </div>

        <p style="font-size: 14px; line-height: 1.6; color: #374151;">Hi ${safeClient},</p>
        <p style="font-size: 14px; line-height: 1.6; color: #374151;">Please review the post preview below before it goes live on your social accounts:</p>

        <div style="margin: 20px 0; padding: 16px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
          <div style="font-size: 12px; font-weight: 600; color: #6b7280; margin-bottom: 8px;">📅 Scheduled for: ${scheduledTimeStr}</div>
          ${mediaThumbUrl ? `<div style="margin: 10px 0;"><img src="${mediaThumbUrl}" alt="Post thumbnail" style="max-width: 100%; max-height: 280px; border-radius: 6px; object-fit: cover;" /></div>` : ''}
          ${safeCaption ? `<div style="font-size: 14px; color: #1f2937; line-height: 1.5; white-space: pre-wrap; margin-top: 8px;">${safeCaption}</div>` : ''}
        </div>

        <div style="margin: 28px 0; text-align: center;">
          <a href="${reviewUrl}" style="background-color: #10b981; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block;">Review & Approve Post</a>
        </div>

        <p style="font-size: 12px; color: #6b7280; line-height: 1.5; text-align: center;">
          Zero login required. You can approve with 1 click or request changes directly on the preview.
        </p>

        <div style="margin-top: 32px; border-top: 1px solid #f3f4f6; padding-top: 16px; font-size: 11px; color: #9ca3af; text-align: center;">
          VS Adda · Agency-Client Collaboration
        </div>
      </div>
    `;

    return this.dispatchEmail({
      to: toEmail,
      subject,
      html,
    });
  }

  /**
   * Send 3-day reminder to brand client
   */
  static async sendConnectReminder(params: SendReminderEmailParams): Promise<EmailDeliveryResult> {
    const { toEmail, clientName, brandName, agencyName, inviteUrl } = params;

    const safeBrand = escapeHtml(brandName);
    const safeAgency = escapeHtml(agencyName);
    const safeClient = escapeHtml(clientName || 'there');

    const subject = `Reminder: Connect your social accounts for ${brandName}`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; color: #161a1e; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
        <div style="margin-bottom: 24px;">
          <span style="display: inline-block; padding: 4px 10px; background: #fef3c7; color: #92400e; font-size: 12px; font-weight: 600; border-radius: 6px; margin-bottom: 12px;">Reminder</span>
          <h2 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: #111827;">Pending Social Connection</h2>
          <p style="margin: 0; color: #4b5563; font-size: 14px;">Your connection link for <strong>${safeBrand}</strong> is still pending.</p>
        </div>

        <p style="font-size: 14px; line-height: 1.6; color: #374151;">Hi ${safeClient},</p>
        <p style="font-size: 14px; line-height: 1.6; color: #374151;">This is a friendly reminder from <strong>${safeAgency}</strong> to link your Facebook and Instagram accounts so that scheduled content and analytics can begin.</p>

        <div style="margin: 32px 0; text-align: center;">
          <a href="${inviteUrl}" target="_blank" style="display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 14px;">
            Complete Connection →
          </a>
        </div>

        <p style="font-size: 12px; color: #6b7280; line-height: 1.5; margin-top: 24px; border-top: 1px solid #f3f4f6; padding-top: 16px;">
          Direct link: <a href="${inviteUrl}" style="color: #4f46e5; word-break: break-all;">${inviteUrl}</a>
        </p>
      </div>
    `;

    return this.dispatchEmail({ to: toEmail, subject, html });
  }

  /**
   * Notify agency admin that client requested a fresh invite link
   */
  static async sendNewLinkRequestedAlert(params: SendRequestNewLinkNotificationParams): Promise<EmailDeliveryResult> {
    const { agencyAdminEmail, clientName, clientEmail, brandName } = params;

    const safeBrand = escapeHtml(brandName);
    const safeClientName = escapeHtml(clientName || 'Client');
    const safeClientEmail = escapeHtml(clientEmail || 'email not specified');

    const subject = `Client requested a new connection link for ${brandName}`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; color: #161a1e; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
        <h2 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #111827;">New Connection Link Requested</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #374151;">
          The previous connection link for <strong>${safeBrand}</strong> has expired or was revoked.
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #374151;">
          Client contact: <strong>${safeClientName}</strong> (${safeClientEmail}).
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #374151;">
          Please log into your VS Adda dashboard and generate a fresh invite link for ${safeBrand}.
        </p>
      </div>
    `;

    return this.dispatchEmail({ to: agencyAdminEmail, subject, html });
  }

  /**
   * Inspect live email provider health without exposing full secrets.
   */
  static async getDiagnostics(): Promise<EmailDiagnostics> {
    const brevoApiKey = readRuntimeEnv('BREVO_API_KEY');
    const resendApiKey = readRuntimeEnv('RESEND_API_KEY');
    const smtpUser = readRuntimeEnv('SMTP_USER');
    const smtpPass = readRuntimeEnv('SMTP_PASS');
    const rawFrom = readRuntimeEnv('EMAIL_FROM', 'VS Adda <washingtonjosh770@gmail.com>');
    const configuredFrom = parseFromAddress(rawFrom);

    const diagnostics: EmailDiagnostics = {
      brevoConfigured: Boolean(brevoApiKey),
      brevoKeyPreview: brevoApiKey ? `${brevoApiKey.slice(0, 10)}...(${brevoApiKey.length} chars)` : undefined,
      brevoAccountValid: false,
      verifiedSenders: [],
      configuredFrom,
      smtpConfigured: Boolean((smtpUser || brevoApiKey) && smtpPass),
      resendConfigured: Boolean(resendApiKey),
    };

    if (brevoApiKey) {
      try {
        const [accRes, sendersRes] = await Promise.all([
          fetch('https://api.brevo.com/v3/account', {
            headers: { 'api-key': brevoApiKey, accept: 'application/json' },
            signal: AbortSignal.timeout(6000),
          }),
          fetch('https://api.brevo.com/v3/senders', {
            headers: { 'api-key': brevoApiKey, accept: 'application/json' },
            signal: AbortSignal.timeout(6000),
          }),
        ]);

        if (accRes.ok) {
          const accData = (await accRes.json()) as any;
          diagnostics.brevoAccountValid = true;
          const freePlan = Array.isArray(accData?.plan) ? accData.plan[0] : undefined;
          diagnostics.brevoCredits = typeof freePlan?.credits === 'number' ? freePlan.credits : undefined;
        } else {
          diagnostics.brevoAccountError = `HTTP ${accRes.status}: ${await accRes.text()}`;
        }

        if (sendersRes.ok) {
          const sendersData = (await sendersRes.json()) as any;
          diagnostics.verifiedSenders = (sendersData?.senders || [])
            .filter((s: any) => s.active)
            .map((s: any) => s.email);
        }
      } catch (err: any) {
        diagnostics.brevoAccountError = err.message;
      }
    }

    return diagnostics;
  }

  private static async fetchBrevoVerifiedSenders(brevoApiKey: string): Promise<Array<{ name: string; email: string }>> {
    try {
      const res = await fetch('https://api.brevo.com/v3/senders', {
        headers: { 'api-key': brevoApiKey, accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as any;
      return (data?.senders || [])
        .filter((s: any) => s.active && s.email)
        .map((s: any) => ({ name: s.name || 'VS Adda', email: s.email }));
    } catch {
      return [];
    }
  }

  private static async fetchBrevoSmtpUsername(brevoApiKey: string): Promise<string | null> {
    try {
      const res = await fetch('https://api.brevo.com/v3/account', {
        headers: { 'api-key': brevoApiKey, accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as any;
      return data?.relay?.data?.userName || null;
    } catch {
      return null;
    }
  }

  /**
   * Low-level dispatcher:
   * 1. Tries Brevo REST API if BREVO_API_KEY is configured (with automatic verified-sender self-healing)
   * 2. Tries Resend API if RESEND_API_KEY is configured
   * 3. Tries SMTP (with Brevo SMTP login auto-resolution & 8s timeouts)
   * 4. Returns truthful EmailDeliveryResult (never silently lies with Mock=true in production)
   */
  private static async dispatchEmail({
    to,
    subject,
    html,
  }: {
    to: string;
    subject: string;
    html: string;
  }): Promise<EmailDeliveryResult> {
    const recipient = to.trim();
    if (!recipient || !recipient.includes('@')) {
      return {
        sent: false,
        provider: 'none',
        to: recipient,
        error: 'Invalid recipient email address',
      };
    }

    const brevoApiKey = readRuntimeEnv('BREVO_API_KEY');
    const resendApiKey = readRuntimeEnv('RESEND_API_KEY');
    const smtpHost = readRuntimeEnv('SMTP_HOST', 'smtp-relay.brevo.com');
    const smtpPortRaw = Number(readRuntimeEnv('SMTP_PORT', String(env.SMTP_PORT || 587)));
    const smtpUser = readRuntimeEnv('SMTP_USER');
    const smtpPass = readRuntimeEnv('SMTP_PASS');
    const rawFrom = readRuntimeEnv('EMAIL_FROM', 'VS Adda <washingtonjosh770@gmail.com>');

    const sender = parseFromAddress(rawFrom);
    const errors: string[] = [];
    let resolvedSender = { ...sender };

    // 1. Try Brevo REST API (Fastest & most reliable, avoids SMTP port blocks & auto-heals sender)
    if (brevoApiKey) {
      const attemptBrevoSend = async (fromSender: { name: string; email: string }) => {
        return fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'api-key': brevoApiKey,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            sender: fromSender,
            to: [{ email: recipient }],
            subject,
            htmlContent: html,
          }),
          signal: AbortSignal.timeout(8000),
        });
      };

      try {
        // Avoid guaranteed rejection for obvious local placeholder senders before sending
        if (
          resolvedSender.email.endsWith('.local') ||
          resolvedSender.email.includes('noreply@vsadda.') ||
          resolvedSender.email.includes('example.com')
        ) {
          const verifiedSenders = await this.fetchBrevoVerifiedSenders(brevoApiKey);
          if (verifiedSenders.length > 0) {
            resolvedSender = {
              name: resolvedSender.name || verifiedSenders[0].name,
              email: verifiedSenders[0].email,
            };
          }
        }

        const response = await attemptBrevoSend(resolvedSender);
        if (response.ok) {
          const data = (await response.json().catch(() => ({}))) as any;
          logger.info(
            { to: recipient, from: resolvedSender.email, subject, messageId: data?.messageId },
            '✅ Email sent via Brevo API successfully'
          );
          return {
            sent: true,
            provider: 'brevo_api',
            from: resolvedSender.email,
            to: recipient,
            messageId: data?.messageId,
          };
        }

        const errText = await response.text();
        logger.warn({ to: recipient, from: resolvedSender.email, status: response.status, errText }, 'Brevo API initial attempt failed');

        // Self-heal unverified / invalid sender automatically if key itself is valid (400 error)
        if (response.status === 400) {
          const verifiedSenders = await this.fetchBrevoVerifiedSenders(brevoApiKey);
          const fallback = verifiedSenders.find((s) => s.email.toLowerCase() !== resolvedSender.email.toLowerCase());
          if (fallback) {
            const healedSender = { name: resolvedSender.name || fallback.name, email: fallback.email };
            const retryRes = await attemptBrevoSend(healedSender);
            if (retryRes.ok) {
              const retryData = (await retryRes.json().catch(() => ({}))) as any;
              logger.info(
                { to: recipient, originalFrom: resolvedSender.email, healedFrom: healedSender.email, subject },
                '✅ Email sent via Brevo API after auto-healing sender email'
              );
              return {
                sent: true,
                provider: 'brevo_api',
                from: healedSender.email,
                to: recipient,
                messageId: retryData?.messageId,
              };
            }
            const retryErrText = await retryRes.text();
            errors.push(`Brevo API (${retryRes.status}): ${retryErrText}`);
          } else {
            errors.push(`Brevo API (${response.status}): ${errText}`);
          }
        } else {
          errors.push(`Brevo API (${response.status}): ${errText}`);
        }
      } catch (err: any) {
        logger.error({ to: recipient, subject, error: err.message }, 'Failed to dispatch email via Brevo API');
        errors.push(`Brevo API network error: ${err.message}`);
      }
    }

    // 2. Try Resend API
    if (resendApiKey) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: `${resolvedSender.name} <${resolvedSender.email}>`,
            to: [recipient],
            subject,
            html,
          }),
          signal: AbortSignal.timeout(8000),
        });

        if (response.ok) {
          const data = (await response.json().catch(() => ({}))) as any;
          logger.info({ to: recipient, subject, messageId: data?.id }, '✅ Email sent via Resend API successfully');
          return {
            sent: true,
            provider: 'resend_api',
            from: resolvedSender.email,
            to: recipient,
            messageId: data?.id,
          };
        } else {
          const errText = await response.text();
          logger.warn({ to: recipient, subject, errText }, 'Resend API returned non-200 status');
          errors.push(`Resend API (${response.status}): ${errText}`);
        }
      } catch (err: any) {
        logger.error({ to: recipient, subject, error: err.message }, 'Failed to dispatch email via Resend API');
        errors.push(`Resend API error: ${err.message}`);
      }
    }

    // 3. Try SMTP (Brevo SMTP relay, Gmail, AWS SES, etc.)
    if (smtpPass && (smtpUser || brevoApiKey)) {
      try {
        const isBrevo = smtpHost.includes('brevo') || smtpHost.includes('sendinblue');
        const port = smtpPortRaw || (isBrevo ? 587 : 465);
        const isSecure = port === 465;

        let effectiveSmtpUser = smtpUser;
        if (isBrevo && (!effectiveSmtpUser || !effectiveSmtpUser.endsWith('@smtp-brevo.com')) && brevoApiKey) {
          const relayUser = await this.fetchBrevoSmtpUsername(brevoApiKey);
          if (relayUser) {
            effectiveSmtpUser = relayUser;
          }
        }

        if (effectiveSmtpUser) {
          const transporter = nodemailer.createTransport({
            host: smtpHost || (isBrevo ? 'smtp-relay.brevo.com' : 'smtp.gmail.com'),
            port,
            secure: isSecure,
            connectionTimeout: 8000,
            greetingTimeout: 8000,
            socketTimeout: 10000,
            auth: {
              user: effectiveSmtpUser,
              pass: smtpPass,
            },
          });

          const info = await transporter.sendMail({
            from: `"${resolvedSender.name}" <${resolvedSender.email}>`,
            to: recipient,
            subject,
            html,
          });

          logger.info({ to: recipient, subject, messageId: info?.messageId }, '✅ Email sent via SMTP transporter successfully');
          return {
            sent: true,
            provider: 'smtp',
            from: resolvedSender.email,
            to: recipient,
            messageId: info?.messageId,
          };
        }
      } catch (err: any) {
        logger.error({ to: recipient, subject, error: err.message }, 'Failed to dispatch email via SMTP');
        errors.push(`SMTP error: ${err.message}`);
      }
    }

    // 4. In test environments without credentials, allow safe mock pass-through
    const nodeEnv = cleanEnvString(process.env.NODE_ENV) || env.NODE_ENV;
    if (nodeEnv === 'test' && !brevoApiKey && !resendApiKey && !smtpPass) {
      logger.info({ to: recipient, subject }, '📧 [EmailService Test Mock] Simulated dispatch in test environment');
      return {
        sent: true,
        provider: 'mock',
        from: resolvedSender.email,
        to: recipient,
      };
    }

    const failureReason =
      errors.length > 0
        ? errors.join(' | ')
        : 'No active email provider configured (BREVO_API_KEY / SMTP_PASS missing on server)';

    logger.error(
      { to: recipient, subject, from: resolvedSender.email, errors },
      '❌ Failed to deliver email to client'
    );

    return {
      sent: false,
      provider: 'none',
      from: resolvedSender.email,
      to: recipient,
      error: failureReason,
    };
  }
}
