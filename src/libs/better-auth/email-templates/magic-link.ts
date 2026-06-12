import { BRANDING_NAME } from '@lobechat/business-const';

import {
  type EmailTranslate,
  formatDuration,
  renderEmailLayout,
  renderFallbackLink,
} from './layout';

/**
 * Magic link sign-in email template
 * Sent when user requests passwordless login
 */
export const getMagicLinkEmailTemplate = (params: {
  expiresInSeconds: number;
  lang: string;
  t: EmailTranslate;
  url: string;
}) => {
  const { url, expiresInSeconds, t, lang } = params;

  const duration = formatDuration(t, expiresInSeconds);

  const body = `
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #111827; font-size: 24px; font-weight: 700; margin: 0 0 12px 0; letter-spacing: -0.5px;">
          ${t('magicLink.title', { brand: BRANDING_NAME })}
        </h1>
        <p style="color: #6b7280; font-size: 16px; margin: 0; line-height: 1.5;">
          ${t('magicLink.subtitle')}
        </p>
      </div>

      <!-- Content -->
      <div style="color: #374151; font-size: 16px; line-height: 1.6;">

        <!-- Button -->
        <div style="text-align: center; margin: 32px 0;">
          <a href="${url}" target="_blank"
             style="display: inline-block; background-color: #000000; color: #ffffff; text-decoration: none; padding: 16px 36px; border-radius: 14px; font-weight: 600; font-size: 16px; transition: all 0.2s ease; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
            ${t('magicLink.button')}
          </a>
        </div>

        <!-- Expiration Note -->
        <div style="background-color: #f9fafb; border-radius: 12px; padding: 16px; margin-bottom: 24px; border: 1px solid #f3f4f6;">
          <p style="color: #6b7280; font-size: 13px; margin: 0; text-align: center; line-height: 1.5;">
            ⏰ ${t('magicLink.expiration', { duration: `<strong>${duration}</strong>` })}
          </p>
        </div>

        <p style="color: #6b7280; font-size: 14px; margin: 0 0 8px 0; text-align: center;">
          ${t('magicLink.ignore')}
        </p>
      </div>
      ${renderFallbackLink(t, { url })}`;

  return {
    html: renderEmailLayout({
      body,
      htmlTitle: t('magicLink.htmlTitle', { brand: BRANDING_NAME }),
      lang,
      t,
    }),
    subject: t('magicLink.subject', { brand: BRANDING_NAME }),
    text: t('magicLink.textBody', { duration, url }),
  };
};
