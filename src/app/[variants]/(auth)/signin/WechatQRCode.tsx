'use client';

import { Button, Flexbox, Text } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { signIn } from '@/libs/better-auth/auth-client';

const WECHAT_LOGIN_SCRIPT_URL = 'https://res.wx.qq.com/connect/zh_CN/htmledition/js/wxLogin.js';

let managedWechatScript: HTMLScriptElement | null = null;
let managedWechatScriptUsers = 0;

const styles = createStaticStyles(({ css, cssVar }) => ({
  qrFrame: css`
    overflow: hidden;
    display: grid;
    place-items: center;

    width: 200px;
    height: 200px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 12px;

    background: ${cssVar.colorFillQuaternary};

    iframe {
      width: 100% !important;
      max-width: 100%;
      height: 100% !important;
      max-height: 100%;
      border: 0;
    }
  `,
  qrInner: css`
    width: 100%;
    height: 100%;
  `,
}));

interface WxLoginConfig {
  appid: string;
  id: string;
  redirect_uri: string;
  scope: 'snsapi_login';
  self_redirect: boolean;
  state: string;
  style: 'black';
}

declare global {
  interface Window {
    WxLogin?: new (config: WxLoginConfig) => unknown;
  }
}

const getWechatOauthConfig = async (callbackURL: string) => {
  const result = await signIn.oauth2({
    callbackURL,
    disableRedirect: true,
    providerId: 'wechat',
  });

  if (result.error) {
    throw new Error(result.error.message || 'Failed to initialize WeChat OAuth');
  }

  const authUrl = result.data?.url;
  if (!authUrl) {
    throw new Error('Missing WeChat OAuth authorization URL');
  }

  const url = new URL(authUrl);

  return {
    redirectUri: url.searchParams.get('redirect_uri') ?? '',
    state: url.searchParams.get('state') ?? '',
  };
};

export const WechatQRCode = () => {
  const { t } = useTranslation('auth');
  const [qrVersion, setQrVersion] = useState(0);
  const [scriptReady, setScriptReady] = useState(false);
  const initializedContainerRef = useRef<string | undefined>(undefined);

  const appId = process.env.NEXT_PUBLIC_WECHAT_APP_ID ?? '';
  const qrContainerId = useMemo(() => `wechat-qrcode-${qrVersion}`, [qrVersion]);

  const initializeWechatLogin = useCallback(
    async (isDisposed: () => boolean) => {
      if (!appId || !window.WxLogin) return;

      const container = document.querySelector<HTMLElement>(`#${qrContainerId}`);
      if (!container) return;

      container.innerHTML = '';
      const { redirectUri, state } = await getWechatOauthConfig(window.location.href);

      if (isDisposed() || !window.WxLogin) return;

      new window.WxLogin({
        appid: appId,
        id: qrContainerId,
        redirect_uri: encodeURIComponent(redirectUri),
        scope: 'snsapi_login',
        self_redirect: true,
        state,
        style: 'black',
      });
    },
    [appId, qrContainerId],
  );

  useEffect(() => {
    if (!appId) return;

    let disposed = false;
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${WECHAT_LOGIN_SCRIPT_URL}"]`,
    );
    const script = existingScript ?? document.createElement('script');
    const createdScript = !existingScript;

    const handleLoad = () => {
      if (!disposed) setScriptReady(true);
    };

    if (createdScript) {
      managedWechatScript = script;
      managedWechatScriptUsers += 1;

      script.async = true;
      script.src = WECHAT_LOGIN_SCRIPT_URL;
      document.body.append(script);
    } else if (script === managedWechatScript) {
      managedWechatScriptUsers += 1;
    }

    if (window.WxLogin) {
      setScriptReady(true);
    } else {
      script.addEventListener('load', handleLoad);
    }

    return () => {
      disposed = true;
      script.removeEventListener('load', handleLoad);

      if (script === managedWechatScript) {
        managedWechatScriptUsers -= 1;
      }

      if (script === managedWechatScript && managedWechatScriptUsers <= 0) {
        script.remove();
        managedWechatScript = null;
        managedWechatScriptUsers = 0;
      }
    };
  }, [appId]);

  useEffect(() => {
    if (!scriptReady || initializedContainerRef.current === qrContainerId) return;

    let disposed = false;

    void initializeWechatLogin(() => disposed);
    initializedContainerRef.current = qrContainerId;

    return () => {
      disposed = true;
    };
  }, [initializeWechatLogin, qrContainerId, scriptReady]);

  const handleRefresh = useCallback(() => {
    if (!appId) return;

    setQrVersion((version) => version + 1);
  }, [appId]);

  return (
    <Flexbox align={'center'} gap={16} paddingBlock={12}>
      <div className={styles.qrFrame}>
        {appId ? (
          <div className={styles.qrInner} id={qrContainerId} />
        ) : (
          <Text align={'center'} type={'secondary'}>
            {t('betterAuth.signin.wechatStep.instruction')}
          </Text>
        )}
      </div>
      <Text type={'secondary'}>{t('betterAuth.signin.wechatStep.expiry')}</Text>
      <Button disabled={!appId} icon={RefreshCw} shape={'round'} onClick={handleRefresh}>
        {t('betterAuth.signin.wechatStep.refresh')}
      </Button>
    </Flexbox>
  );
};
