import { BRANDING_NAME } from '@lobechat/business-const';

import { type EmailTranslate, formatDuration, renderEmailLayout } from './layout';

/**
 * Email OTP verification template for mobile
 * Sent to users when they need to verify their email using OTP code
 */
export const getVerificationOTPEmailTemplate = (params: {
  expiresInSeconds: number;
  lang: string;
  otp: string;
  t: EmailTranslate;
  userName?: string | null;
}) => {
  const { otp, userName, expiresInSeconds, t, lang } = params;

  const duration = formatDuration(t, expiresInSeconds);

  const body = `
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #111827; font-size: 24px; font-weight: 700; margin: 0 0 12px 0; letter-spacing: -0.5px;">
          ${t('otp.title')}
        </h1>
        <p style="color: #6b7280; font-size: 16px; margin: 0;">
          ${t('otp.subtitle')}
        </p>
      </div>

      <!-- Content -->
      <div style="color: #374151; font-size: 16px; line-height: 1.6;">
        ${userName ? `<p style="margin: 0 0 16px 0;">${t('greeting', { name: `<strong>${userName}</strong>` })}</p>` : ''}

        <p style="margin: 0 0 24px 0;">
          ${t('otp.body', { brand: BRANDING_NAME })}
        </p>

        <!-- OTP Code Box -->
        <div style="text-align: center; margin: 36px 0;">
          <div style="display: inline-block; background-color: #000000; padding: 24px 48px; border-radius: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
            <div style="font-size: 36px; font-weight: 700; letter-spacing: 12px; color: #ffffff; font-family: 'Courier New', Courier, monospace;">
              ${otp}
            </div>
          </div>
        </div>

        <!-- Expiration Note -->
        <div style="background-color: #f9fafb; border-radius: 12px; padding: 16px; margin-bottom: 24px; border: 1px solid #f3f4f6;">
          <p style="color: #6b7280; font-size: 14px; margin: 0; text-align: center;">
            ⏰ ${t('otp.expiration', { duration: `<strong>${duration}</strong>` })}
          </p>
        </div>

        <p style="color: #6b7280; font-size: 15px; margin: 0 0 8px 0;">
          ${t('otp.ignore')}
        </p>
      </div>

      <!-- Divider -->
      <div style="border-top: 1px solid #e5e7eb; margin: 32px 0;"></div>

      <!-- Security Note -->
      <div style="text-align: center;">
        <p style="color: #9ca3af; font-size: 13px; margin: 0 0 8px 0;">
          ${t('otp.security')}
        </p>
      </div>`;

  return {
    html: renderEmailLayout({ body, htmlTitle: t('otp.htmlTitle'), lang, t }),
    subject: t('otp.subject', { brand: BRANDING_NAME }),
    text: t('otp.textBody', { duration, otp }),
  };
};
