import { BRANDING_NAME } from '@lobechat/business-const';

import {
  type EmailTranslate,
  formatDuration,
  renderEmailLayout,
  renderFallbackLink,
} from './layout';

/**
 * Change email verification template
 * Sent to users when they request to change their email address
 */
export const getChangeEmailVerificationTemplate = (params: {
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
          ${t('changeEmail.title')}
        </h1>
        <p style="color: #6b7280; font-size: 16px; margin: 0;">
          ${t('changeEmail.subtitle')}
        </p>
      </div>

      <!-- Content -->
      <div style="color: #374151; font-size: 16px; line-height: 1.6;">
        ${userName ? `<p style="margin: 0 0 16px 0;">${t('greeting', { name: `<strong>${userName}</strong>` })}</p>` : ''}

        <p style="margin: 0 0 24px 0;">
          ${t('changeEmail.body', { brand: BRANDING_NAME })}
        </p>

        <!-- Button -->
        <div style="text-align: center; margin: 36px 0;">
          <a href="${url}" target="_blank"
             style="display: inline-block; background-color: #000000; color: #ffffff; text-decoration: none; padding: 16px 36px; border-radius: 14px; font-weight: 600; font-size: 16px; transition: transform 0.1s ease; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
            ${t('changeEmail.button')}
          </a>
        </div>

        <!-- Expiration Note -->
        <div style="background-color: #f9fafb; border-radius: 12px; padding: 16px; margin-bottom: 24px; border: 1px solid #f3f4f6;">
          <p style="color: #6b7280; font-size: 14px; margin: 0; text-align: center;">
            ⏰ ${t('changeEmail.expiration', { duration: `<strong>${duration}</strong>` })}
          </p>
        </div>

        <p style="color: #6b7280; font-size: 15px; margin: 0 0 8px 0;">
          ${t('changeEmail.ignore')}
        </p>
      </div>
      ${renderFallbackLink(t, { url })}`;

  return {
    html: renderEmailLayout({ body, htmlTitle: t('changeEmail.htmlTitle'), lang, t }),
    subject: t('changeEmail.subject', { brand: BRANDING_NAME }),
    text: t('changeEmail.textBody', { brand: BRANDING_NAME, duration, url }),
  };
};
