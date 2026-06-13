import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const analyticsTrack = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en-US' },
    t: (key: string) =>
      ({
        'changelog': 'Changelog',
        'productHunt.actionLabel': 'Support us',
        'productHunt.description': 'Support us on Product Hunt.',
        'productHunt.title': "We're on Product Hunt!",
        'userPanel.discord': 'Discord',
        'userPanel.docs': 'Docs',
        'userPanel.feedback': 'Feedback',
        'userPanel.help': 'Help',
        'userPanel.setting': 'Settings',
      })[key] || key,
  }),
}));

// Within the Product Hunt window (2026-01-27 → 2026-02-01).
const WITHIN_PRODUCT_HUNT_WINDOW = new Date('2026-01-28T00:00:00Z');
// Outside the window.
const OUTSIDE_PRODUCT_HUNT_WINDOW = new Date('2026-06-13T00:00:00Z');

interface RenderFooterOptions {
  now?: Date;
  readSlugs?: string[];
  serverConfigInit?: boolean;
}

let mockGlobalState: Record<string, unknown>;
let mockServerConfigState: Record<string, unknown>;

interface MockStoreHook {
  (selector: (state: Record<string, unknown>) => unknown): unknown;
  getState: () => Record<string, unknown>;
}

const createGlobalState = (readSlugs: string[] = []) => ({
  status: {
    readNotificationSlugs: readSlugs,
  },
  updateSystemStatus: vi.fn((patch: { readNotificationSlugs?: string[] }) => {
    mockGlobalState = {
      ...mockGlobalState,
      status: {
        ...(mockGlobalState.status as Record<string, unknown>),
        ...patch,
      },
    };
  }),
});

const renderFooter = async ({
  now = WITHIN_PRODUCT_HUNT_WINDOW,
  readSlugs = [],
  serverConfigInit = true,
}: RenderFooterOptions = {}) => {
  vi.resetModules();
  analyticsTrack.mockReset();
  // Pin the clock to a fixed instant WITHOUT fake timers — installing a fake
  // timer (even Date-only) deadlocks RTL render / userEvent under React 19.
  // Stub the Date constructor so `new Date()` / `Date.now()` are deterministic
  // while setTimeout/microtasks stay real.
  const fixedNow = now.getTime();
  const RealDate = Date;
  class MockDate extends RealDate {
    constructor(...args: any[]) {
      if (args.length === 0) super(fixedNow);
      else super(...(args as []));
    }
    static now() {
      return fixedNow;
    }
  }
  vi.stubGlobal('Date', MockDate);
  vi.stubGlobal('localStorage', {
    getItem: vi.fn(() => null),
    removeItem: vi.fn(),
    setItem: vi.fn(),
  });

  mockGlobalState = createGlobalState(readSlugs);
  mockServerConfigState = {
    featureFlags: {},
    serverConfigInit,
  };

  function createAnalyticsApi() {
    return {
      analytics: { track: analyticsTrack },
    };
  }
  vi.doMock('@lobehub/analytics/react', () => ({
    useAnalytics: createAnalyticsApi,
  }));
  vi.doMock('@/components/ChangelogModal', () => ({
    default: () => null,
  }));
  vi.doMock('@/components/HighlightNotification', () => ({
    default: (props: {
      actionLabel?: string;
      description?: string;
      onAction?: () => void;
      onActionClick?: () => void;
      onClose?: () => void;
      open?: boolean;
      title?: string;
    }) =>
      props.open ? (
        <div data-testid="highlight-notification">
          <div>{props.title}</div>
          <div>{props.description}</div>
          <button type="button" onClick={props.onClose}>
            Close promo
          </button>
          {props.actionLabel && (
            <button
              type="button"
              onClick={() => {
                if (props.onAction) props.onAction();
                else props.onActionClick?.();
              }}
            >
              {props.actionLabel}
            </button>
          )}
        </div>
      ) : null,
  }));
  vi.doMock('@/features/User/UserPanel/ThemeButton', () => ({
    default: () => null,
  }));
  // Isolate Footer from heavy siblings that pull in the tool store — under
  // vi.resetModules() their dependency graph triggers a circular import.
  vi.doMock('@/features/Billboard', () => ({
    default: () => null,
  }));
  vi.doMock('@/features/NavPanel', () => ({
    useActiveNavKey: () => 'home',
  }));
  function createFeedbackModalApi() {
    return { open: vi.fn() };
  }
  vi.doMock('@/hooks/useFeedbackModal', () => ({
    useFeedbackModal: createFeedbackModalApi,
  }));
  function createNavLayoutState() {
    return {
      bottomMenuItems: [],
      footer: {
        hideGitHub: true,
        layout: 'compact',
        showEvalEntry: false,
        showSettingsEntry: true,
      },
      topNavItems: [],
      userPanel: {
        showDataImporter: false,
        showMemory: true,
      },
    };
  }
  vi.doMock('@/hooks/useNavLayout', () => ({
    useNavLayout: createNavLayoutState,
  }));
  const selectFromGlobalStore = ((selector: (state: Record<string, unknown>) => unknown) =>
    selector(mockGlobalState)) as MockStoreHook;
  vi.doMock('@/store/global', () => {
    selectFromGlobalStore.getState = () => mockGlobalState;

    return { useGlobalStore: selectFromGlobalStore };
  });
  function selectFromServerConfigStore(selector: (state: Record<string, unknown>) => unknown) {
    return selector(mockServerConfigState);
  }
  vi.doMock('@/store/serverConfig', () => ({
    useServerConfigStore: selectFromServerConfigStore,
  }));

  const { default: Footer } = await import('./index');

  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<Footer />} path="/" />
      </Routes>
    </MemoryRouter>,
  );
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.doUnmock('@lobehub/analytics/react');
  vi.doUnmock('@/components/ChangelogModal');
  vi.doUnmock('@/components/HighlightNotification');
  vi.doUnmock('@/features/User/UserPanel/ThemeButton');
  vi.doUnmock('@/features/Billboard');
  vi.doUnmock('@/features/NavPanel');
  vi.doUnmock('@/hooks/useFeedbackModal');
  vi.doUnmock('@/hooks/useNavLayout');
  vi.doUnmock('@/store/global');
  vi.doUnmock('@/store/serverConfig');
});

describe('Footer product hunt promotion', () => {
  it('auto-shows the product hunt promotion within the launch window', async () => {
    await renderFooter();

    expect(screen.getByTestId('highlight-notification')).toBeInTheDocument();
    expect(screen.getByText("We're on Product Hunt!")).toBeInTheDocument();
    expect(analyticsTrack).toHaveBeenCalledWith({
      name: 'product_hunt_card_viewed',
      properties: {
        spm: 'homepage.product_hunt.viewed',
        trigger: 'auto',
      },
    });
  }, 40000);

  it('stores the dismiss slug when the product hunt promotion is closed', async () => {
    const user = userEvent.setup();
    await renderFooter();
    const card = screen.getAllByTestId('highlight-notification').at(-1)!;

    await user.click(within(card).getByRole('button', { name: 'Close promo' }));

    expect(
      (mockGlobalState.status as { readNotificationSlugs: string[] }).readNotificationSlugs,
    ).toContain('product-hunt-2026');
  }, 20000);

  it('does not auto-show the promotion outside the launch window', async () => {
    await renderFooter({ now: OUTSIDE_PRODUCT_HUNT_WINDOW });

    expect(screen.queryByTestId('highlight-notification')).not.toBeInTheDocument();
  });

  it('does not auto-show the promotion after the current device has dismissed it', async () => {
    await renderFooter({ readSlugs: ['product-hunt-2026'] });

    expect(screen.queryByTestId('highlight-notification')).not.toBeInTheDocument();
  });
});
