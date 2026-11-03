import nodemailer from 'nodemailer';
import { logger } from './logger.js';
import { env } from '../config/env.js';

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

export class EmailService {
  /**
   * Send social connect onboarding invite to brand client
   */
  static async sendConnectInvite(params: SendInviteEmailParams): Promise<boolean> {
    const { toEmail, clientName, brandName, agencyName, inviteUrl, expiresInDays = 7 } = params;

    const subject = `Connect social media accounts for ${brandName} · ${agencyName}`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; color: #161a1e; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
        <div style="margin-bottom: 24px;">
          <h2 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: #111827;">Connect Social Channels</h2>
          <p style="margin: 0; color: #4b5563; font-size: 14px;"><strong>${agencyName}</strong> has invited you to connect the official social media accounts for <strong>${brandName}</strong>.</p>
        </div>

        <p style="font-size: 14px; line-height: 1.6; color: #374151;">Hi ${clientName || 'there'},</p>
        <p style="font-size: 14px; line-height: 1.6; color: #374151;">To allow ${agencyName} to manage, schedule, and publish posts on behalf of ${brandName}, please click the secure link below to link your Facebook & Instagram pages. No agency account or password required.</p>

        <div style="margin: 32px 0; text-align: center;">
          <a href="${inviteUrl}" target="_blank" style="display: inline-block; background: #161a1e; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
            Connect ${brandName} Accounts →
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
   * Send 3-day reminder to brand client
   */
  static async sendConnectReminder(params: SendReminderEmailParams): Promise<boolean> {
    const { toEmail, clientName, brandName, agencyName, inviteUrl } = params;

    const subject = `Reminder: Connect your social accounts for ${brandName}`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; color: #161a1e; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
        <div style="margin-bottom: 24px;">
          <span style="display: inline-block; padding: 4px 10px; background: #fef3c7; color: #92400e; font-size: 12px; font-weight: 600; border-radius: 6px; margin-bottom: 12px;">Reminder</span>
          <h2 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: #111827;">Pending Social Connection</h2>
          <p style="margin: 0; color: #4b5563; font-size: 14px;">Your connection link for <strong>${brandName}</strong> is still pending.</p>
        </div>

        <p style="font-size: 14px; line-height: 1.6; color: #374151;">Hi ${clientName || 'there'},</p>
        <p style="font-size: 14px; line-height: 1.6; color: #374151;">This is a friendly reminder from <strong>${agencyName}</strong> to link your Facebook and Instagram accounts so that scheduled content and analytics can begin.</p>

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
  static async sendNewLinkRequestedAlert(params: SendRequestNewLinkNotificationParams): Promise<boolean> {
    const { agencyAdminEmail, clientName, clientEmail, brandName } = params;

    const subject = `Client requested a new connection link for ${brandName}`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; color: #161a1e; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
        <h2 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #111827;">New Connection Link Requested</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #374151;">
          The previous connection link for <strong>${brandName}</strong> has expired or was revoked.
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #374151;">
          Client contact: <strong>${clientName || 'Client'}</strong> (${clientEmail || 'email not specified'}).
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #374151;">
          Please log into your VS Adda dashboard and generate a fresh invite link for ${brandName}.
        </p>
      </div>
    `;

    return this.dispatchEmail({ to: agencyAdminEmail, subject, html });
  }

  /**
   * Low-level dispatcher:
   * 1. Tries Brevo REST API if BREVO_API_KEY is configured
   * 2. Tries Resend API if RESEND_API_KEY is configured
   * 3. Tries SMTP (Brevo SMTP, Gmail, SES, etc.) if SMTP_USER/PASS configured
   * 4. Otherwise logs delivery safely for dev/testing.
   */
  private static async dispatchEmail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<boolean> {
    const brevoApiKey = env.BREVO_API_KEY || process.env.BREVO_API_KEY;
    const resendApiKey = process.env.RESEND_API_KEY;

    // Helper to parse "Name <email@domain.com>" or "email@domain.com"
    const parseFromAddress = (raw: string) => {
      const match = raw.match(/^(.*?)\s*<([^>]+)>$/);
      if (match) {
        return { name: match[1].trim() || 'VS Adda', email: match[2].trim() };
      }
      return { name: 'VS Adda', email: raw.trim() };
    };

    const sender = parseFromAddress(env.EMAIL_FROM || 'VS Adda <noreply@vsadda.com>');

    // 1. Try Brevo REST API (Fastest & most reliable, no SMTP port blocks)
    if (brevoApiKey) {
      try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'api-key': brevoApiKey,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            sender: {
              name: sender.name,
              email: sender.email,
            },
            to: [{ email: to }],
            subject,
            htmlContent: html,
          }),
        });

        if (response.ok) {
          logger.info({ to, subject }, '✅ Email sent via Brevo API successfully');
          return true;
        } else {
          const errText = await response.text();
          logger.warn({ to, subject, errText }, 'Brevo API returned non-200 status');
        }
      } catch (err: any) {
        logger.error({ to, subject, error: err.message }, 'Failed to dispatch email via Brevo API');
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
            from: env.EMAIL_FROM || 'onboarding@resend.dev',
            to: [to],
            subject,
            html,
          }),
        });

        if (response.ok) {
          logger.info({ to, subject }, '✅ Email sent via Resend API successfully');
          return true;
        } else {
          const errText = await response.text();
          logger.warn({ to, subject, errText }, 'Resend API returned non-200 status');
        }
      } catch (err: any) {
        logger.error({ to, subject, error: err.message }, 'Failed to dispatch email via Resend API');
      }
    }

    // 3. Try SMTP (Brevo SMTP relay, Gmail, AWS SES, etc.)
    if (env.SMTP_USER && env.SMTP_PASS) {
      try {
        const isBrevo = env.SMTP_HOST.includes('brevo') || env.SMTP_HOST.includes('sendinblue');
        const port = env.SMTP_PORT || (isBrevo ? 587 : 465);
        const isSecure = port === 465;

        const transporter = nodemailer.createTransport({
          host: env.SMTP_HOST || (isBrevo ? 'smtp-relay.brevo.com' : 'smtp.gmail.com'),
          port,
          secure: isSecure,
          auth: {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
          },
        });

        await transporter.sendMail({
          from: env.EMAIL_FROM || env.SMTP_USER,
          to,
          subject,
          html,
        });

        logger.info({ to, subject }, '✅ Email sent via SMTP transporter successfully');
        return true;
      } catch (err: any) {
        logger.error({ to, subject, error: err.message }, 'Failed to dispatch email via SMTP');
      }
    }

    // 4. Fallback mock logging for dev/testing
    logger.info(
      { to, subject, from: env.EMAIL_FROM },
      '📧 [EmailService Mock] Automated email dispatched to client (Add BREVO_API_KEY or SMTP_USER/PASS in .env for live inbox delivery)'
    );
    return true;
  }
}
