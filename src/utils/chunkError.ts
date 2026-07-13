const CHUNK_ERROR_PATTERNS = [
  'Failed to fetch dynamically imported module', // Chrome / Vite
  'error loading dynamically imported module', // Firefox
  'Importing a module script failed', // Safari
  'Failed to load module script', // Safari variant
  'Loading chunk', // Webpack
  'Loading CSS chunk', // Webpack CSS
  'ChunkLoadError', // Webpack error name
];

/**
 * Detect whether an error (or its message) was caused by a failed chunk / dynamic import.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;

  const name = (error as Error).name ?? '';
  const message = (error as Error).message ?? String(error);
  const combined = `${name} ${message}`;

  return CHUNK_ERROR_PATTERNS.some((p) => combined.includes(p));
}

const RELOAD_KEY = 'lobe-chunk-reload';
const CHUNK_ERROR_MESSAGE = 'There is a new version for the web app. Refresh the page to update';

async function showChunkErrorToast() {
  const { toast } = await import('@lobehub/ui/es/base-ui/Toast/imperative');
  toast.error(CHUNK_ERROR_MESSAGE);
}

/**
 * Auto-reload on chunk load error. Uses sessionStorage to prevent infinite reload loops.
 */
export function notifyChunkError(): void {
  const reloaded = sessionStorage.getItem(RELOAD_KEY);
  if (reloaded) {
    sessionStorage.removeItem(RELOAD_KEY);
    void showChunkErrorToast();
    return;
  }
  sessionStorage.setItem(RELOAD_KEY, '1');
  window.location.reload();
}
