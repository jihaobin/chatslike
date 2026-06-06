import { createDecipheriv, createSign, createVerify, randomUUID } from 'node:crypto';

export interface WechatPayConfig {
  apiV3Key: string;
  appId: string;
  mchId: string;
  notifyUrl: string;
  privateKey: string;
  publicKey: string;
  publicKeyId: string;
  serialNo: string;
}

export interface WechatNativeOrderParams {
  amountCents: number;
  description: string;
  orderId: string;
}

export interface WechatEncryptedResource {
  associated_data?: string;
  ciphertext: string;
  nonce: string;
}

export interface WechatTransactionResource {
  amount?: { currency?: string; total?: number };
  appid?: string;
  mchid?: string;
  out_trade_no?: string;
  trade_state?: string;
  transaction_id?: string;
}

interface RequestParams {
  body?: Record<string, unknown>;
  method: string;
  path: string;
}

const WECHAT_PAY_API_BASE_URL = 'https://api.mch.weixin.qq.com';

export class WechatPayApiV3Service {
  constructor(private readonly config: WechatPayConfig) {}

  createNativeTransaction = async (params: WechatNativeOrderParams) => {
    const response = await this.request<{ code_url: string }>({
      body: {
        amount: { currency: 'CNY', total: params.amountCents },
        appid: this.config.appId,
        description: params.description.slice(0, 127),
        mchid: this.config.mchId,
        notify_url: this.config.notifyUrl,
        out_trade_no: params.orderId,
      },
      method: 'POST',
      path: '/v3/pay/transactions/native',
    });

    return { codeUrl: response.code_url };
  };

  closeTransactionByOutTradeNo = async (orderId: string) => {
    await this.request<void>({
      body: { mchid: this.config.mchId },
      method: 'POST',
      path: `/v3/pay/transactions/out-trade-no/${encodeURIComponent(orderId)}/close`,
    });
  };

  queryTransactionByOutTradeNo = async (orderId: string) => {
    return this.request<WechatTransactionResource>({
      method: 'GET',
      path: `/v3/pay/transactions/out-trade-no/${encodeURIComponent(orderId)}?mchid=${encodeURIComponent(
        this.config.mchId,
      )}`,
    });
  };

  decryptResource = <T>(resource: WechatEncryptedResource): T => {
    if (Buffer.byteLength(this.config.apiV3Key) !== 32) {
      throw new Error('WeChat Pay API v3 key must be 32 bytes');
    }

    const ciphertext = Buffer.from(resource.ciphertext, 'base64');
    const authTag = ciphertext.subarray(ciphertext.length - 16);
    const encrypted = ciphertext.subarray(0, ciphertext.length - 16);
    const decipher = createDecipheriv(
      'aes-256-gcm',
      Buffer.from(this.config.apiV3Key),
      resource.nonce,
    );
    if (resource.associated_data) {
      decipher.setAAD(Buffer.from(resource.associated_data));
    }
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    return JSON.parse(decrypted.toString('utf8')) as T;
  };

  verifyNotification = (params: { headers: Headers; rawBody: string }) => {
    const timestamp = params.headers.get('Wechatpay-Timestamp');
    const nonce = params.headers.get('Wechatpay-Nonce');
    const signature = params.headers.get('Wechatpay-Signature');
    const serial = params.headers.get('Wechatpay-Serial');

    if (!timestamp || !nonce || !signature || serial !== this.config.publicKeyId) {
      throw new Error('WeChat Pay signature verification failed');
    }

    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${timestamp}\n${nonce}\n${params.rawBody}\n`);
    verifier.end();

    if (!verifier.verify(this.config.publicKey, signature, 'base64')) {
      throw new Error('WeChat Pay signature verification failed');
    }
  };

  private request = async <T>(params: RequestParams): Promise<T> => {
    const bodyText = params.body ? JSON.stringify(params.body) : '';
    const authorization = this.signRequest({
      bodyText,
      method: params.method,
      requestTarget: params.path,
    });
    const response = await fetch(`${WECHAT_PAY_API_BASE_URL}${params.path}`, {
      body: bodyText || undefined,
      headers: {
        'Accept': 'application/json',
        'Authorization': authorization,
        'Content-Type': 'application/json',
      },
      method: params.method,
    });

    if (!response.ok) {
      throw new Error(`WeChat Pay request failed: ${response.status} ${await response.text()}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const responseText = await response.text();
    if (!responseText) {
      return undefined as T;
    }

    return JSON.parse(responseText) as T;
  };

  private signRequest = (params: { bodyText: string; method: string; requestTarget: string }) => {
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = randomUUID().replaceAll('-', '');
    const signMessage = `${params.method}\n${params.requestTarget}\n${timestamp}\n${nonce}\n${params.bodyText}\n`;
    const signer = createSign('RSA-SHA256');
    signer.update(signMessage);
    signer.end();
    const signature = signer.sign(this.config.privateKey, 'base64');

    return `WECHATPAY2-SHA256-RSA2048 mchid="${this.config.mchId}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${this.config.serialNo}"`;
  };
}
