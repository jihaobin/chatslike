import { LOBE_LOCALE_COOKIE } from '@/const/locale';
import { translation } from '@/server/translation';

/**
 * Loose shape accepted by the locale helpers.
 *
 * Better Auth passes different things as the second callback argument:
 * - `sendVerificationEmail` / `sendResetPassword` receive a raw `Request`
 *   (has `headers: Headers`).
 * - `emailOTP` / `magicLink` plugins receive a `GenericEndpointContext`
 *   (has an optional nested `request` and/or `headers`).
 *
 * All fields are optional so both forms are assignable here.
 */
export interface RequestLike {
  headers?: Headers | null;
  request?: { headers?: Headers | null } | null;
}

const resolveHeaders = (source?: RequestLike): Headers | null | undefined =>
  source?.headers ?? source?.request?.headers;

/**
 * Resolve the user's preferred locale from a Better Auth request/context.
 * Order of preference: LOBE_LOCALE cookie -> Accept-Language header -> default.
 * Returns undefined when no hint is found so `translation` falls back to DEFAULT_LANG.
 */
export const getRequestLocale = (source?: RequestLike): string | undefined => {
  const headers = resolveHeaders(source);
  if (!headers) return undefined;

  // 1. Explicit locale cookie set by the app
  const cookieHeader = headers.get('cookie');
  if (cookieHeader) {
    const match = cookieHeader
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${LOBE_LOCALE_COOKIE}=`));

    if (match) {
      const value = decodeURIComponent(match.slice(LOBE_LOCALE_COOKIE.length + 1));
      if (value) return value;
    }
  }

  // 2. Browser Accept-Language header (take the first, highest-priority entry)
  const acceptLanguage = headers.get('accept-language');
  if (acceptLanguage) {
    const primary = acceptLanguage.split(',')[0]?.split(';')[0]?.trim();
    if (primary) return primary;
  }

  return undefined;
};

/**
 * Build the email-namespace translate function for the locale carried by a request.
 */
export const getEmailTranslation = async (source?: RequestLike) => {
  const locale = getRequestLocale(source);
  const { t, locale: resolvedLocale } = await translation('email', locale ?? '');

  return { lang: resolvedLocale, t };
};
