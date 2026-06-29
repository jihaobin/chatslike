// Auth/Next.js routes that must NOT go to SPA catch-all.
// Shared between middleware (define-config.ts) and the client Link adapter.
export const nextjsOnlyRoutes = [
  '/signin',
  '/auth-error',
  '/oauth',
  '/market-auth-callback',
  '/discover',
  '/welcome',
  '/verify-im',
];
