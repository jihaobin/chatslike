import { render, screen } from '@testing-library/react';

import Notification from './Notification';

const state = vi.hoisted(() => ({
  cloudEnabled: true,
}));

vi.mock('@lobechat/const', () => ({
  isDesktop: true,
}));

vi.mock('@/business/shared/commercialRuntime', () => ({
  commercialRuntime: {
    lobeHubCloudIntegration: {
      get enabled() {
        return state.cloudEnabled;
      },
    },
  },
}));

vi.mock('./SubscriptionIframeWrapper', () => ({
  SubscriptionIframeWrapper: ({ page }: { page: string }) => (
    <div data-page={page} data-testid="subscription-iframe-wrapper" />
  ),
}));

describe('Notification', () => {
  beforeEach(() => {
    state.cloudEnabled = true;
  });

  it('renders the notification embed page on desktop', () => {
    render(<Notification />);

    expect(screen.getByTestId('subscription-iframe-wrapper')).toHaveAttribute(
      'data-page',
      'notification',
    );
  });

  it('renders empty when LobeHub Cloud integration is disabled', () => {
    state.cloudEnabled = false;

    const { container } = render(<Notification />);

    expect(screen.queryByTestId('subscription-iframe-wrapper')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });
});
