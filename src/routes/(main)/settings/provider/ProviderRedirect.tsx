'use client';

import { memo } from 'react';
import { Navigate } from 'react-router-dom';

interface ProviderRedirectProps {
  scope?: 'global' | 'user';
}

/**
 * Index landing for /settings/provider.
 *
 * Always redirects to the `all` grid page. When `hide_provider_templates` is ON, the
 * grid page itself fetches the provider list and forwards to the first enabled provider
 * (or stays on the grid as an empty-state fallback). Keeping the smart decision in the
 * grid page means every entry point that links straight to `/all` behaves consistently.
 */
const ProviderRedirect = memo<ProviderRedirectProps>(({ scope = 'user' }) => {
  const prefix = `/settings/provider/${scope === 'global' ? 'global/' : ''}`;
  return <Navigate replace to={`${prefix}all`} />;
});

ProviderRedirect.displayName = 'ProviderRedirect';

export default ProviderRedirect;
