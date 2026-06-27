import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WechatQRCode } from './WechatQRCode';

const wxLoginMock = vi.fn();
const originalWechatAppId = process.env.NEXT_PUBLIC_WECHAT_APP_ID;
const originalCryptoDescriptor = Object.getOwnPropertyDescriptor(window, 'crypto');

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const clearWechatScripts = () => {
  for (const script of document.querySelectorAll(
    'script[src="https://res.wx.qq.com/connect/zh_CN/htmledition/js/wxLogin.js"]',
  )) {
    script.remove();
  }
};

describe('WechatQRCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearWechatScripts();
    process.env.NEXT_PUBLIC_WECHAT_APP_ID = 'wx-test-app-id';
    delete window.WxLogin;
    Object.defineProperty(window, 'crypto', {
      configurable: true,
      value: { randomUUID: vi.fn(() => 'test-state') },
    });
    window.history.replaceState({}, '', 'http://localhost:3000/signin');
  });

  afterEach(() => {
    clearWechatScripts();
    delete window.WxLogin;

    if (originalWechatAppId === undefined) {
      delete process.env.NEXT_PUBLIC_WECHAT_APP_ID;
    } else {
      process.env.NEXT_PUBLIC_WECHAT_APP_ID = originalWechatAppId;
    }

    if (originalCryptoDescriptor) {
      Object.defineProperty(window, 'crypto', originalCryptoDescriptor);
    } else {
      delete (window as Partial<Window>).crypto;
    }
  });

  it('loads the official script and initializes WxLogin with the WeChat OAuth callback', async () => {
    render(<WechatQRCode />);

    const script = document.querySelector<HTMLScriptElement>(
      'script[src="https://res.wx.qq.com/connect/zh_CN/htmledition/js/wxLogin.js"]',
    );
    expect(script).toBeInTheDocument();

    window.WxLogin = wxLoginMock as unknown as Window['WxLogin'];
    script?.dispatchEvent(new Event('load'));

    await waitFor(() => {
      expect(wxLoginMock).toHaveBeenCalledWith(
        expect.objectContaining({
          appid: 'wx-test-app-id',
          redirect_uri: encodeURIComponent('http://localhost:3000/api/auth/callback/wechat'),
          scope: 'snsapi_login',
          self_redirect: true,
          state: 'test-state',
          style: 'black',
        }),
      );
    });
  });

  it('refreshes the QR code with a new container and state', async () => {
    const randomUUID = vi.fn().mockReturnValueOnce('state-1').mockReturnValueOnce('state-2');
    Object.defineProperty(window, 'crypto', {
      configurable: true,
      value: { randomUUID },
    });

    render(<WechatQRCode />);

    const script = document.querySelector<HTMLScriptElement>(
      'script[src="https://res.wx.qq.com/connect/zh_CN/htmledition/js/wxLogin.js"]',
    );
    expect(script).toBeInTheDocument();

    window.WxLogin = wxLoginMock as unknown as Window['WxLogin'];
    script?.dispatchEvent(new Event('load'));

    await waitFor(() => {
      expect(wxLoginMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'betterAuth.signin.wechatStep.refresh' }));

    await waitFor(() => {
      expect(wxLoginMock).toHaveBeenCalledTimes(2);
    });
    expect(wxLoginMock).toHaveBeenLastCalledWith(expect.objectContaining({ state: 'state-2' }));
    expect(wxLoginMock.mock.calls[1][0].id).not.toBe(wxLoginMock.mock.calls[0][0].id);
    expect(
      document.querySelectorAll(
        'script[src="https://res.wx.qq.com/connect/zh_CN/htmledition/js/wxLogin.js"]',
      ),
    ).toHaveLength(1);
    expect(
      document.querySelector(
        'script[src="https://res.wx.qq.com/connect/zh_CN/htmledition/js/wxLogin.js"]',
      ),
    ).toBe(script);
  });

  it('does not initialize WxLogin when the app id is missing', () => {
    delete process.env.NEXT_PUBLIC_WECHAT_APP_ID;

    render(<WechatQRCode />);

    expect(wxLoginMock).not.toHaveBeenCalled();
    expect(
      document.querySelector(
        'script[src="https://res.wx.qq.com/connect/zh_CN/htmledition/js/wxLogin.js"]',
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByText('betterAuth.signin.wechatStep.instruction')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'betterAuth.signin.wechatStep.refresh' }),
    ).toBeDisabled();
  });
});
