import { BRANDING_NAME } from '@lobechat/business-const';

import { type EmailTranslate, renderEmailLayout, renderFallbackLink } from './layout';

/**
 * Password reset email template
 * Sent to users when they request a password reset
 */
export const getResetPasswordEmailTemplate = (params: {
  lang: string;
  t: EmailTranslate;
  url: string;
}) => {
  const { url, t, lang } = params;

  const body = `
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #111827; font-size: 24px; font-weight: 700; margin: 0 0 12px 0; letter-spacing: -0.5px;">
          ${t('resetPassword.title')}
        </h1>
        <p style="color: #6b7280; font-size: 16px; margin: 0; line-height: 1.5;">
          ${t('resetPassword.subtitle')}
        </p>
      </div>

      <!-- Content -->
      <div style="color: #374151; font-size: 16px; line-height: 1.6;">
        <p style="margin: 0 0 24px 0; text-align: center;">
          ${t('resetPassword.body', { brand: BRANDING_NAME })}
        </p>

        <!-- Button -->
        <div style="text-align: center; margin: 32px 0;">
          <a href="${url}" target="_blank"
             style="display: inline-block; background-color: #000000; color: #ffffff; text-decoration: none; padding: 16px 36px; border-radius: 14px; font-weight: 600; font-size: 16px; transition: all 0.2s ease; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
            ${t('resetPassword.button')}
          </a>
        </div>

        <!-- Security Note -->
        <div style="background-color: #f9fafb; border-radius: 12px; padding: 16px; margin-bottom: 24px; border: 1px solid #f3f4f6;">
          <p style="color: #6b7280; font-size: 13px; margin: 0; text-align: center; line-height: 1.5;">
            ${t('resetPassword.security')}
          </p>
        </div>
      </div>
      ${renderFallbackLink(t, { url })}`;

  return {
    html: renderEmailLayout({ body, htmlTitle: t('resetPassword.htmlTitle'), lang, t }),
    subject: t('resetPassword.subject', { brand: BRANDING_NAME }),
    text: t('resetPassword.textBody', { url }),
  };
};
