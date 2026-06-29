import '../initialize';

import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import BootErrorBoundary from '@/components/BootErrorBoundary';
import { createAppRouter } from '@/utils/router';

import { desktopRoutes } from './router/desktopRouter.config';

// Sync user language preference before React renders to avoid i18n flash.
// SPAGlobalProvider reads document.documentElement.lang to init i18next;
// if we set it here, the correct language is used from the very first render.
try {
  const raw = localStorage.getItem('LOBE_SYSTEM_STATUS');
  if (raw) {
    const { language } = JSON.parse(raw);
    if (language) {
      document.documentElement.lang = language === 'auto' ? navigator.language : language;
    }
  }
} catch {}

const debugProxyBase = '/_dangerous_local_dev_proxy';
const basename =
  window.__DEBUG_PROXY__ || window.location.pathname.startsWith(debugProxyBase)
    ? debugProxyBase
    : undefined;

const router = createAppRouter(desktopRoutes, { basename });

createRoot(document.getElementById('root')!).render(
  <BootErrorBoundary>
    <RouterProvider router={router} />
  </BootErrorBoundary>,
);
