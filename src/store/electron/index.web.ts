// Web-build stub for the Electron store.
//
// vitePlatformResolve resolves '@/store/electron' to this file in web builds,
// preventing the real store.ts (and its heavy @lobechat/electron-client-ipc
// transitive dependencies, zustand devtools wiring, IPC bridge, etc.) from
// being bundled into the web JS chunks.
//
// All components that import useElectronStore / getElectronStoreState already
// guard on __ELECTRON__ or isDesktop before using the returned values, so
// receiving empty/default state is safe in the web build.

// Minimal default state that satisfies the selectors used from web-side code.
// Values mirror src/store/electron/initialState.ts defaults without importing
// @lobechat/electron-client-ipc (an Electron-only package).
const webState = {
  appState: {} as Record<string, unknown>,
  appTrayVisible: false,
  dataSyncConfig: { storageMode: 'cloud' as const },
  desktopHotkeys: {} as Record<string, string>,
  gatewayConnectionStatus: 'disconnected' as const,
  isAppStateInit: false,
  isConnectingServer: false,
  isConnectionDrawerOpen: false,
  isDesktopHotkeysInit: false,
  isInitRemoteServerConfig: false,
  isSyncActive: false,
  navigationHistory: [] as unknown[],
  proxySettings: {
    enableProxy: false,
    proxyBypass: 'localhost, 127.0.0.1, ::1',
    proxyPort: '',
    proxyRequireAuth: false,
    proxyServer: '',
    proxyType: 'http' as const,
  },
  recentPages: [] as unknown[],
  tabPages: [] as unknown[],
};

type WebState = typeof webState;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySelector<T = any> = (state: any) => T;

/**
 * No-op store hook for the web build.
 * The selector is called with the static default state object;
 * the hook never re-renders because the state never changes.
 */
export const useElectronStore = <T>(selector: AnySelector<T>): T => selector(webState);

// Attach the static subset of the zustand store API that callers may use.
useElectronStore.getState = (): WebState => webState;
useElectronStore.setState = (_partial: unknown) => {};
// Returns an unsubscribe no-op so callers can safely call the result.
useElectronStore.subscribe = (_listener: unknown) => () => {};
useElectronStore.destroy = () => {};

/** Returns the static default web state (no IPC, no Electron bridge). */
export const getElectronStoreState = (): WebState => webState;
