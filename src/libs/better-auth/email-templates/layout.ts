import { BRANDING_LOGO_URL, BRANDING_NAME } from '@lobechat/business-const';
import { OFFICIAL_SITE } from '@lobechat/const';

const emailLogoUrl = new URL(BRANDING_LOGO_URL, OFFICIAL_SITE).toString();

/**
 * Minimal translate function shape compatible with `src/server/translation.ts`.
 */
export type EmailTranslate = (key: string, options?: Record<string, string>) => string;

/**
 * Format an expiration duration into a localized, human-readable string.
 * The custom server translate fn has no plural support, so we pick explicit
 * singular/plural keys here.
 */
export const formatDuration = (t: EmailTranslate, totalSeconds: number): string => {
  const count = (value: number) =>
    String(Number.isInteger(value) ? value : Number(value.toFixed(2)));

  const hours = totalSeconds / 3600;
  if (hours >= 1) {
    return t(hours > 1 ? 'duration.hours' : 'duration.hour', { count: count(hours) });
  }

  const minutes = totalSeconds / 60;
  if (minutes >= 1) {
    return t(minutes > 1 ? 'duration.minutes' : 'duration.minute', { count: count(minutes) });
  }

  return t(totalSeconds > 1 ? 'duration.seconds' : 'duration.second', {
    count: count(totalSeconds),
  });
};

interface EmailLayoutParams {
  /** Inner HTML of the card body (header + content). */
  body: string;
  /** HTML document <title>. */
  htmlTitle: string;
  /** Document lang attribute, e.g. "en", "zh-CN". */
  lang: string;
  t: EmailTranslate;
}

/**
 * Shared email shell: logo header, white card, and footer.
 * Templates only provide the card body, keeping branding and chrome in one place.
 */
export const renderEmailLayout = ({ body, htmlTitle, lang, t }: EmailLayoutParams): string => `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${htmlTitle}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; color: #1a1a1a;">
  <!-- Container -->
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">

    <!-- Logo -->
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="display: inline-flex; align-items: center; justify-content: center; background-color: #ffffff; border-radius: 12px; padding: 8px 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
        <img src="${emailLogoUrl}" alt="LOGO" width="24" height="24" style="display: block; width: 24px; height: 24px; margin-right: 10px; border: 0;">
        <span style="font-size: 18px; font-weight: 700; color: #000000; letter-spacing: -0.5px;">${BRANDING_NAME}</span>
      </div>
    </div>

    <!-- Card -->
    <div style="background: #ffffff; border-radius: 20px; padding: 40px; box-shadow: 0 8px 30px rgba(0,0,0,0.04); border: 1px solid rgba(0,0,0,0.02);">
      ${body}
    </div>

    <!-- Footer -->
    <div style="text-align: center; margin-top: 32px;">
      <p style="color: #a1a1aa; font-size: 13px; margin: 0;">
        ${t('footer.copyright', { brand: BRANDING_NAME, year: String(new Date().getFullYear()) })}
      </p>
    </div>
  </div>
</body>
</html>
`;

interface FallbackLinkParams {
  hint?: string;
  url: string;
}

/**
 * Shared "button not working, copy this link" block with divider.
 */
export const renderFallbackLink = (
  t: EmailTranslate,
  { hint, url }: FallbackLinkParams,
): string => `
      <!-- Divider -->
      <div style="border-top: 1px solid #e5e7eb; margin: 32px 0;"></div>

      <!-- Fallback Link -->
      <div style="text-align: center;">
        <p style="color: #9ca3af; font-size: 13px; margin: 0 0 8px 0;">
          ${hint ?? t('fallback.hint')}
        </p>
        <a href="${url}" style="color: #2563eb; font-size: 13px; text-decoration: none; word-break: break-all; display: block; line-height: 1.4;">
          ${url}
        </a>
      </div>`;
