'use client';

import { Button, Flexbox, Text } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const WECHAT_LOGIN_SCRIPT_URL = 'https://res.wx.qq.com/connect/zh_CN/htmledition/js/wxLogin.js';
const WECHAT_CALLBACK_PATH = '/api/auth/callback/wechat';

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

const createFallbackState = () => {
  const crypto = globalThis.crypto;

  if (crypto?.getRandomValues) {
    const values = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(values, (value) => value.toString(16).padStart(2, '0')).join('');
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

const createWechatState = () => globalThis.crypto?.randomUUID?.() ?? createFallbackState();

export const WechatQRCode = () => {
  const { t } = useTranslation('auth');
  const [qrVersion, setQrVersion] = useState(0);
  const [scriptReady, setScriptReady] = useState(false);
  const initializedContainerRef = useRef<string | undefined>(undefined);

  const appId = process.env.NEXT_PUBLIC_WECHAT_APP_ID ?? '';
  const qrContainerId = useMemo(() => `wechat-qrcode-${qrVersion}`, [qrVersion]);

  const initializeWechatLogin = useCallback(() => {
    if (!appId || !window.WxLogin) return;

    const container = document.querySelector<HTMLElement>(`#${qrContainerId}`);
    if (!container) return;

    container.innerHTML = '';

    new window.WxLogin({
      appid: appId,
      id: qrContainerId,
      redirect_uri: encodeURIComponent(`${window.location.origin}${WECHAT_CALLBACK_PATH}`),
      scope: 'snsapi_login',
      self_redirect: true,
      state: createWechatState(),
      style: 'black',
    });
  }, [appId, qrContainerId]);

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

    initializeWechatLogin();
    initializedContainerRef.current = qrContainerId;
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
