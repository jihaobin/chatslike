import { BRANDING_NAME } from '@lobechat/business-const';

import {
  type EmailTranslate,
  formatDuration,
  renderEmailLayout,
  renderFallbackLink,
} from './layout';

/**
 * Email verification template
 * Sent to users when they sign up to verify their email address
 */
export const getVerificationEmailTemplate = (params: {
  expiresInSeconds: number;
  lang: string;
  t: EmailTranslate;
  url: string;
  userName?: string | null;
}) => {
  const { url, userName, expiresInSeconds, t, lang } = params;

  const duration = formatDuration(t, expiresInSeconds);

  const body = `
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #111827; font-size: 24px; font-weight: 700; margin: 0 0 12px 0; letter-spacing: -0.5px;">
          ${t('verification.title')}
        </h1>
        <p style="color: #6b7280; font-size: 16px; margin: 0;">
          ${t('verification.subtitle')}
        </p>
      </div>

      <!-- Content -->
      <div style="color: #374151; font-size: 16px; line-height: 1.6;">
        ${userName ? `<p style="margin: 0 0 16px 0;">${t('greeting', { name: `<strong>${userName}</strong>` })}</p>` : ''}

        <p style="margin: 0 0 24px 0;">
          ${t('verification.body', { brand: BRANDING_NAME })}
        </p>

        <!-- Button -->
        <div style="text-align: center; margin: 36px 0;">
          <a href="${url}" target="_blank"
             style="display: inline-block; background-color: #000000; color: #ffffff; text-decoration: none; padding: 16px 36px; border-radius: 14px; font-weight: 600; font-size: 16px; transition: transform 0.1s ease; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
            ${t('verification.button')}
          </a>
        </div>

        <!-- Expiration Note -->
        <div style="background-color: #f9fafb; border-radius: 12px; padding: 16px; margin-bottom: 24px; border: 1px solid #f3f4f6;">
          <p style="color: #6b7280; font-size: 14px; margin: 0; text-align: center;">
            ⏰ ${t('verification.expiration', { duration: `<strong>${duration}</strong>` })}
          </p>
        </div>

        <p style="color: #6b7280; font-size: 15px; margin: 0 0 8px 0;">
          ${t('verification.ignore')}
        </p>
      </div>
      ${renderFallbackLink(t, { url })}`;

  return {
    html: renderEmailLayout({ body, htmlTitle: t('verification.htmlTitle'), lang, t }),
    subject: t('verification.subject', { brand: BRANDING_NAME }),
    text: t('verification.textBody', { duration, url }),
  };
};
