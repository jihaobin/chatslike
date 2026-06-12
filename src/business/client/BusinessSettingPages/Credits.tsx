'use client';

import {
  Button,
  Empty,
  Flexbox,
  Icon,
  InputNumber,
  Select,
  Skeleton,
  Tag,
  Text,
} from '@lobehub/ui';
import { message, Radio } from 'antd';
import { createStaticStyles, cssVar } from 'antd-style';
import {
  BoxIcon,
  ChevronRightIcon,
  PencilIcon,
  ReceiptTextIcon,
  RefreshCwIcon,
  ShoppingCartIcon,
  WalletCardsIcon,
  WifiIcon,
} from 'lucide-react';
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import type { TopUpProductId } from '@/business/shared/billingProducts';
import { TOP_UP_PRODUCTS } from '@/business/shared/billingProducts';
import UserAvatar from '@/features/User/UserAvatar';
import { billingService } from '@/services/billing';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';
import { formatNumber } from '@/utils/format';

import CreditAmount from './components/CreditAmount';
import { type PaymentChannel, PaymentChannelModal } from './components/PaymentChannelModal';
import { PaymentQrCodeModal, type PaymentQrCodeStatus } from './components/PaymentQrCodeModal';
import StatusTag from './components/StatusTag';
import {
  refreshBillingOrders,
  useBillingBalance,
  useBillingGrantPackages,
  useBillingOrderPaymentStatus,
  useCurrentSubscription,
} from './hooks/useBillingData';
import { formatBillingAmount } from './utils';

type PackageTab = 'active' | 'depleted' | 'expired';

interface CreatedTopUpOrder {
  order: Awaited<ReturnType<typeof billingService.createTopUpOrder>>['order'];
  payment: Awaited<ReturnType<typeof billingService.createTopUpOrder>>['payment'];
}

interface TabIndicatorStyle {
  opacity: number;
  width: number;
  x: number;
}

const MILLION = 1_000_000;
const CUSTOM_PRODUCT_ID = 'custom';
const QR_CODE_EXPIRE_MS = 15 * 60 * 1000;

const styles = createStaticStyles(({ css, cssVar: token }) => ({
  autoTopUpAction: css`
    align-self: flex-start;

    min-width: 88px;
    height: 36px;
    margin-inline-start: auto;
    border-radius: 8px;
  `,
  autoTopUpBody: css`
    min-height: 62px;
  `,
  balanceCard: css`
    position: absolute;
    inset-block-start: 12px;
    inset-inline-end: 16px;

    width: min(350px, 38%);
    min-height: 200px;
    padding-block: 20px 14px;
    padding-inline: 16px;
    border: 1px solid ${token.colorBorder};
    border-radius: 14px;

    background: ${token.colorBgContainer};
    box-shadow: ${token.boxShadowSecondary};

    @media (width <= 860px) {
      position: static;
      width: 100%;
    }
  `,
  balanceContainer: css`
    position: relative;
    min-height: 226px;
    padding-block: 16px 0;
    padding-inline: 16px 38%;

    @media (width <= 860px) {
      padding-inline-end: 16px;
    }
  `,
  balanceFooter: css`
    margin-block-start: 28px;
    padding-block: 10px;
    border-block-start: 1px solid ${token.colorBorderSecondary};
  `,
  balanceTitleBar: css`
    height: 52px;
    padding-inline: 16px;
    border-block-end: 1px solid ${token.colorBorderSecondary};
  `,
  buyFooter: css`
    min-height: 74px;
    padding-block-start: 20px;
    border-block-start: 1px solid ${token.colorBorderSecondary};
  `,
  buyProductButton: css`
    min-width: 100px;
    height: 36px;
    border: 1px solid transparent !important;
    border-radius: 8px;

    font-weight: 500;

    background: ${token.colorFillQuaternary};
    box-shadow: none !important;

    transition:
      border-color 160ms ease,
      box-shadow 160ms ease,
      color 160ms ease,
      background 160ms ease;

    &:hover,
    &:focus {
      border-color: ${token.colorBorder} !important;
      color: ${token.colorText};
      background: ${token.colorFillSecondary} !important;
    }

    &[data-selected='true'] {
      border-color: ${token.colorText} !important;

      font-weight: 700;
      color: ${token.colorText};

      background: ${token.colorBgContainer};
      box-shadow: inset 0 0 0 1px ${token.colorText} !important;
    }

    &[data-selected='true']:hover,
    &[data-selected='true']:focus {
      border-color: ${token.colorText} !important;
      background: ${token.colorBgContainer} !important;
      box-shadow: inset 0 0 0 1px ${token.colorText} !important;
    }

    @media (width <= 640px) {
      min-width: calc(33.333% - 8px);
    }
  `,
  customProductButton: css`
    min-width: 108px;
  `,
  customProductInputRow: css`
    width: fit-content;
  `,
  filterSelect: css`
    width: 148px;
  `,
  grantItem: css`
    padding-block: 14px;
    padding-inline: 16px;
    border-block-end: 1px solid ${token.colorBorderSecondary};

    &:last-child {
      border-block-end: none;
    }
  `,
  grantList: css`
    min-height: 214px;
  `,
  inputAffix: css`
    font-size: 14px;
    color: ${token.colorText};
  `,
  inlineLink: css`
    cursor: pointer;

    display: inline-flex;
    gap: 6px;
    align-items: center;

    font-weight: 600;
    color: ${token.colorLink};
    text-decoration: none;

    transition: color 160ms ease;

    &:hover {
      color: ${token.colorLinkHover};
      text-decoration: none;
    }
  `,
  metricNumber: css`
    font-size: 24px;
    font-weight: 700;
    line-height: 1.25;
    color: ${token.colorText};
  `,
  packageHeader: css`
    min-height: 62px;
  `,
  page: css`
    width: 100%;
    max-width: 1024px;
    margin-block: 0;
    margin-inline: auto;
    padding-block-end: 48px;
  `,
  pageHeader: css`
    padding-block: 8px 28px;
    border-block-end: 1px solid ${token.colorBorderSecondary};
  `,
  paymentCardBrand: css`
    font-size: 12px;
    font-weight: 700;
    color: ${token.colorTextSecondary};
    text-transform: uppercase;
    letter-spacing: 0;
  `,
  paymentCardPlan: css`
    margin-block-start: 24px;

    font-size: 34px;
    font-weight: 800;
    line-height: 1.1;
    color: ${token.colorText};
  `,
  sectionShell: css`
    overflow: hidden;

    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 8px;

    background: ${token.colorBgContainer};
    box-shadow: ${token.boxShadowTertiary};
  `,
  sectionTitleBand: css`
    min-height: 52px;
    padding-inline: 16px;
    border-radius: 8px 8px 0 0;
    background: ${token.colorFillQuaternary};
  `,
  tabBar: css`
    position: relative;
  `,
  tabButton: css`
    box-sizing: border-box;
    height: 40px;
    padding-block: 0;
    padding-inline: 14px;
    border-color: transparent !important;
    border-style: solid !important;
    border-width: 0 !important;
    border-radius: 7px;

    color: ${token.colorTextSecondary};

    background: transparent !important;
    box-shadow: none !important;

    transition:
      color 160ms ease,
      background 160ms ease;

    &:hover,
    &:focus,
    &:active {
      border-color: transparent !important;
      border-style: solid !important;
      border-width: 0 !important;

      color: ${token.colorText};

      background: ${token.colorFillSecondary} !important;
      box-shadow: none !important;
    }

    &[data-active='true'] {
      color: ${token.colorText};
    }

    &[data-active='true']:hover,
    &[data-active='true']:focus,
    &[data-active='true']:active {
      color: ${token.colorText};
    }
  `,
  tabIndicator: css`
    pointer-events: none;

    position: absolute;
    inset-block-end: 11px;
    inset-inline-start: 0;

    height: 3px;
    border-radius: 999px;

    background: ${token.colorText};

    transition:
      opacity 120ms ease,
      transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
      width 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
  `,
  warningInput: css`
    width: 160px;
  `,
}));

const formatMillionAmount = (credits: number) => {
  const value = credits / MILLION;

  return Number.isInteger(value) ? `${value}M` : `${value.toFixed(2)}M`;
};

const getCreditsMillion = (credits: number) => credits / MILLION;

const getProductById = (productId: TopUpProductId) =>
  TOP_UP_PRODUCTS.find((product) => product.id === productId) ?? TOP_UP_PRODUCTS[0];

const getPackageTab = (
  grant: Awaited<ReturnType<typeof billingService.listGrantPackages>>['packages'][number],
) => {
  if (grant.status === 'expired') return 'expired';
  if (grant.status === 'depleted' || grant.remainingCredits <= 0) return 'depleted';

  return 'active';
};

const Credits = memo(() => {
  const { t } = useTranslation('subscription');
  const { data: balance, isLoading: balanceLoading, mutate: mutateBalance } = useBillingBalance();
  const {
    data: grantSummary,
    isLoading: grantsLoading,
    mutate: mutateGrants,
  } = useBillingGrantPackages();
  const { data: currentSubscription } = useCurrentSubscription();
  const displayName = useUserStore(userProfileSelectors.displayUserName);
  const [createdOrder, setCreatedOrder] = useState<CreatedTopUpOrder>();
  const [createOrderError, setCreateOrderError] = useState<string>();
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [isPaymentChannelModalOpen, setIsPaymentChannelModalOpen] = useState(false);
  const [isPaymentQrCodeModalOpen, setIsPaymentQrCodeModalOpen] = useState(false);
  const [isPaymentSuccessful, setIsPaymentSuccessful] = useState(false);
  const [isQrCodeExpired, setIsQrCodeExpired] = useState(false);
  const [paymentChannel, setPaymentChannel] = useState<PaymentChannel>();
  const [paymentQrCodeCreatedAt, setPaymentQrCodeCreatedAt] = useState<number>();
  const [productId, setProductId] = useState<TopUpProductId>(TOP_UP_PRODUCTS[0].id);
  const [customCreditsMillion, setCustomCreditsMillion] = useState(1);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const customInputRowRef = useRef<HTMLDivElement>(null);
  const [selectedProduct, setSelectedProduct] = useState<TopUpProductId | typeof CUSTOM_PRODUCT_ID>(
    TOP_UP_PRODUCTS[0].id,
  );
  const [packageTab, setPackageTab] = useState<PackageTab>('active');
  const packageTabBarRef = useRef<HTMLDivElement>(null);
  const [tabIndicator, setTabIndicator] = useState<TabIndicatorStyle>({
    opacity: 0,
    width: 0,
    x: 0,
  });
  const [sourceFilter, setSourceFilter] = useState('all');
  const [sortFilter, setSortFilter] = useState('newest');
  const { data: paymentStatus } = useBillingOrderPaymentStatus(createdOrder?.order.id);
  const polledOrder = paymentStatus?.order;
  const paymentTradeState = paymentStatus?.paymentTradeState;
  const lastNotifiedOrderStateRef = useRef<string | undefined>(undefined);

  const activeSummary = grantSummary?.active ?? {
    rechargeCredits: balance?.availableCredits ?? 0,
    subscriptionCredits: 0,
    totalCredits: balance?.availableCredits ?? 0,
  };
  const currentProduct = getProductById(productId);
  const subscriptionCredits = activeSummary.subscriptionCredits;
  const rechargeCredits = activeSummary.rechargeCredits;
  const totalAvailableCredits = balance?.availableCredits ?? activeSummary.totalCredits;
  const selectedPricePerMillion =
    currentProduct.amountCents / 100 / (currentProduct.credits / MILLION);
  const totalAmountCents =
    selectedProduct === CUSTOM_PRODUCT_ID
      ? Math.round(customCreditsMillion * selectedPricePerMillion * 100)
      : currentProduct.amountCents;
  const currentPlanName = currentSubscription?.planId
    ? t(`billingNative.plans.planName.${currentSubscription.planId}`, currentSubscription.planId)
    : t('billingNative.plans.free.name', 'Free');
  const currentPlanLabel = currentPlanName.toUpperCase();
  const isPaymentQrCodeExpired =
    isQrCodeExpired ||
    Boolean(
      isPaymentQrCodeModalOpen &&
      paymentQrCodeCreatedAt !== undefined &&
      Date.now() - paymentQrCodeCreatedAt >= QR_CODE_EXPIRE_MS,
    );
  const paymentQrCodeStatus: PaymentQrCodeStatus = isPaymentQrCodeExpired
    ? 'expired'
    : paymentTradeState === 'USERPAYING'
      ? 'paying'
      : polledOrder?.status === 'paid' || paymentTradeState === 'SUCCESS'
        ? 'loading'
        : polledOrder?.status === 'closed' ||
            paymentTradeState === 'CLOSED' ||
            paymentTradeState === 'REVOKED'
          ? 'expired'
          : 'waiting';

  const visiblePackages = useMemo(() => {
    const grants = grantSummary?.packages ?? [];

    return grants
      .filter((grant) => getPackageTab(grant) === packageTab)
      .filter((grant) => sourceFilter === 'all' || grant.source === sourceFilter)
      .sort((a, b) => {
        if (sortFilter === 'expiring') {
          const aTime = a.expiresAt ? new Date(a.expiresAt).getTime() : Number.MAX_SAFE_INTEGER;
          const bTime = b.expiresAt ? new Date(b.expiresAt).getTime() : Number.MAX_SAFE_INTEGER;

          return aTime - bTime;
        }

        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [grantSummary?.packages, packageTab, sortFilter, sourceFilter]);

  useEffect(() => {
    if (!createdOrder || !polledOrder?.status) return;

    const notifiedKey = `${createdOrder.order.id}:${polledOrder.status}:${paymentTradeState ?? ''}`;
    if (lastNotifiedOrderStateRef.current === notifiedKey) return;
    lastNotifiedOrderStateRef.current = notifiedKey;

    if (paymentTradeState === 'USERPAYING') {
      message.info(
        t('billingNative.paymentStatus.paying', 'Scanned. Confirm the payment on your phone.'),
      );
      return;
    }

    if (polledOrder.status === 'paid') {
      message.info(
        t('billingNative.paymentStatus.paying', 'Scanned. Confirm the payment on your phone.'),
      );
      return;
    }

    if (polledOrder.status === 'activated') {
      setIsPaymentQrCodeModalOpen(false);
      setIsPaymentSuccessful(true);
      message.success(
        t('billingNative.paymentStatus.success', 'Payment successful. Credits have been added.'),
      );
      void Promise.all([mutateBalance(), mutateGrants(), refreshBillingOrders()]);
      return;
    }

    if (polledOrder.status === 'failed' || polledOrder.status === 'exception') {
      setIsPaymentQrCodeModalOpen(false);
      message.error(t('billingNative.paymentStatus.failed', 'Payment failed. Please try again.'));
      void refreshBillingOrders();
      return;
    }

    if (polledOrder.status === 'closed') {
      setIsPaymentQrCodeModalOpen(false);
      message.info(t('billingNative.paymentStatus.cancelled', 'Payment cancelled'));
      void refreshBillingOrders();
    }
  }, [createdOrder, mutateBalance, mutateGrants, paymentTradeState, polledOrder?.status, t]);

  useEffect(() => {
    if (!isPaymentQrCodeModalOpen || paymentQrCodeCreatedAt === undefined) return;

    const remainingMs = paymentQrCodeCreatedAt + QR_CODE_EXPIRE_MS - Date.now();
    if (remainingMs <= 0) {
      setIsQrCodeExpired(true);
      message.warning(
        t('billingNative.paymentStatus.expired', 'The QR code has expired. Refresh to try again.'),
      );
      return;
    }

    const timer = window.setTimeout(() => {
      setIsQrCodeExpired(true);
      message.warning(
        t('billingNative.paymentStatus.expired', 'The QR code has expired. Refresh to try again.'),
      );
    }, remainingMs);

    return () => window.clearTimeout(timer);
  }, [isPaymentQrCodeModalOpen, paymentQrCodeCreatedAt, t]);

  useEffect(() => {
    if (!showCustomInput) return;

    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-custom-product-trigger="true"]')) return;
      if (customInputRowRef.current?.contains(target)) return;

      setShowCustomInput(false);
    };

    document.addEventListener('mousedown', handleDocumentMouseDown);

    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown);
    };
  }, [showCustomInput]);

  useLayoutEffect(() => {
    const tabBar = packageTabBarRef.current;
    const activeTab = tabBar?.querySelector<HTMLButtonElement>(
      `[data-package-tab="${packageTab}"]`,
    );
    if (!tabBar || !activeTab) return;

    const tabBarRect = tabBar.getBoundingClientRect();
    const activeTabRect = activeTab.getBoundingClientRect();

    setTabIndicator({
      opacity: 1,
      width: activeTabRect.width,
      x: activeTabRect.left - tabBarRect.left,
    });
  }, [packageTab]);

  const handleProductSelect = (value: TopUpProductId | typeof CUSTOM_PRODUCT_ID) => {
    setSelectedProduct(value);
    setShowCustomInput(value === CUSTOM_PRODUCT_ID);
    if (value === CUSTOM_PRODUCT_ID) {
      setCustomCreditsMillion(getCreditsMillion(currentProduct.credits));
      return;
    }
    setProductId(value);
  };

  const handleCustomCreditsChange = (value: number | string | null) => {
    const nextValue = Math.max(1, Number(value ?? 1));
    setCustomCreditsMillion(nextValue);

    const credits = nextValue * MILLION;
    const nearestProduct = TOP_UP_PRODUCTS.find((product) => product.credits === credits);
    if (nearestProduct) setProductId(nearestProduct.id);
  };

  const handleCreateOrder = async (channel: PaymentChannel) => {
    setIsPaymentChannelModalOpen(false);
    setIsCreatingOrder(true);
    setCreateOrderError(undefined);
    setIsPaymentSuccessful(false);
    setIsQrCodeExpired(false);
    setPaymentChannel(channel);

    try {
      const result = await billingService.createTopUpOrder({ channel, productId });
      setCreatedOrder(result);
      setIsPaymentQrCodeModalOpen(Boolean(result.payment.qrCodeUrl));
      setPaymentQrCodeCreatedAt(Date.now());
      lastNotifiedOrderStateRef.current = undefined;
      await refreshBillingOrders();
    } catch (error) {
      setCreateOrderError(error instanceof Error ? error.message : String(error));
      message.error(
        t(
          'billingNative.paymentStatus.createFailed',
          'Failed to create the order. Please try again later.',
        ),
      );
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const handleRefreshQrCode = async () => {
    if (!paymentChannel) return;

    setIsCreatingOrder(true);
    setCreateOrderError(undefined);

    try {
      const result = await billingService.createTopUpOrder({ channel: paymentChannel, productId });
      setCreatedOrder(result);
      setIsQrCodeExpired(false);
      setIsPaymentQrCodeModalOpen(Boolean(result.payment.qrCodeUrl));
      setPaymentQrCodeCreatedAt(Date.now());
      lastNotifiedOrderStateRef.current = undefined;
      await refreshBillingOrders();
    } catch (error) {
      setCreateOrderError(error instanceof Error ? error.message : String(error));
      message.error(
        t(
          'billingNative.paymentStatus.createFailed',
          'Failed to create the order. Please try again later.',
        ),
      );
    } finally {
      setIsCreatingOrder(false);
    }
  };

  if (balanceLoading || grantsLoading || !balance) {
    return <Skeleton active paragraph={{ rows: 10 }} title={false} />;
  }

  return (
    <Flexbox className={styles.page} gap={38}>
      <Flexbox className={styles.pageHeader}>
        <Text as={'h1'} fontSize={24} weight={700}>
          {t('billingNative.credits.pageTitle', 'Credits')}
        </Text>
      </Flexbox>

      <Flexbox gap={18}>
        <Flexbox className={styles.sectionTitleBand} justify={'center'}>
          <Text weight={700}>{t('billingNative.credits.balance.title', 'Balance')}</Text>
        </Flexbox>
        <Flexbox className={styles.sectionShell}>
          <Flexbox className={styles.balanceContainer} gap={16}>
            <Flexbox gap={8}>
              <Text weight={700}>
                {t('billingNative.credits.balance.recharge', 'Top-up Credits Balance')}
              </Text>
              <Text className={styles.metricNumber}>{formatNumber(rechargeCredits)}</Text>
            </Flexbox>

            <Flexbox gap={12}>
              <Text weight={700}>
                {t('billingNative.credits.balance.subscription', 'Subscription Credits')}
              </Text>
              <Flexbox horizontal align={'center'} gap={8}>
                <Radio disabled checked={subscriptionCredits > 0} />
                <Text weight={600}>{formatNumber(subscriptionCredits)}</Text>
                <Text type={'secondary'}>
                  {t(
                    'billingNative.credits.balance.usageOrder',
                    'Subscription credits are used first, then top-up credits',
                  )}
                </Text>
              </Flexbox>
            </Flexbox>

            <Flexbox horizontal className={styles.balanceFooter} gap={22} wrap={'wrap'}>
              <Link className={styles.inlineLink} to="/settings/usage">
                <Icon color={cssVar.colorLink} icon={ReceiptTextIcon} size={14} />
                {t('billingNative.credits.balance.viewUsage', 'View Usage')}
              </Link>
              <Link className={styles.inlineLink} to="/settings/billing">
                <Icon color={cssVar.colorLink} icon={RefreshCwIcon} size={14} />
                {t('billingNative.credits.balance.topUpHistory', 'Top-up History')}
              </Link>
            </Flexbox>

            <Flexbox className={styles.balanceCard} justify={'space-between'}>
              <Flexbox horizontal align={'center'} justify={'space-between'}>
                <Text className={styles.paymentCardBrand}>
                  {t('billingNative.credits.card.brand', 'Chatslike Cloud Subscription')}
                </Text>
                <Icon icon={WifiIcon} size={16} />
              </Flexbox>
              <Text className={styles.paymentCardPlan}>{currentPlanLabel}</Text>
              <Flexbox horizontal align={'center'} gap={10}>
                <UserAvatar size={32} />
                <Flexbox>
                  <Text weight={700}>
                    {displayName || t('billingNative.credits.card.user', 'User')}
                  </Text>
                  <Text fontSize={11} type={'secondary'}>
                    {t('billingNative.credits.card.account', 'Chatslike account')}
                  </Text>
                </Flexbox>
              </Flexbox>
            </Flexbox>
          </Flexbox>
        </Flexbox>
      </Flexbox>

      <Flexbox gap={18}>
        <Flexbox className={styles.sectionTitleBand} justify={'center'}>
          <Text weight={700}>{t('billingNative.credits.purchase.title', 'Purchase Credits')}</Text>
        </Flexbox>
        <Flexbox className={styles.sectionShell} gap={16} padding={16}>
          <Text weight={700}>
            {t('billingNative.credits.purchase.selectPackage', 'Select Credits Package')}
          </Text>
          <Flexbox horizontal gap={8} wrap={'wrap'}>
            {TOP_UP_PRODUCTS.map((product) => (
              <Button
                className={styles.buyProductButton}
                data-selected={selectedProduct === product.id}
                key={product.id}
                type={'text'}
                onClick={() => handleProductSelect(product.id)}
              >
                {product.name}
              </Button>
            ))}
            <Button
              className={`${styles.buyProductButton} ${styles.customProductButton}`}
              data-custom-product-trigger="true"
              data-selected={selectedProduct === CUSTOM_PRODUCT_ID}
              icon={<Icon icon={PencilIcon} />}
              type={'text'}
              onClick={() => handleProductSelect(CUSTOM_PRODUCT_ID)}
            >
              {t('billingNative.credits.purchase.custom', 'Custom')}
            </Button>
          </Flexbox>

          {showCustomInput ? (
            <div className={styles.customProductInputRow} ref={customInputRowRef}>
              <Flexbox horizontal align={'center'} gap={10} wrap={'wrap'}>
                <InputNumber
                  min={1}
                  placeholder="1"
                  suffix={<span className={styles.inputAffix}>M</span>}
                  value={customCreditsMillion}
                  onChange={handleCustomCreditsChange}
                />
                <Text type={'secondary'}>
                  {t(
                    'billingNative.credits.purchase.customHint',
                    'Custom purchase currently uses the nearest listed package.',
                  )}
                </Text>
              </Flexbox>
            </div>
          ) : null}

          <Flexbox gap={8}>
            <Text type={'secondary'}>
              {t('billingNative.credits.purchase.pricePerMillion', '{{price}} / million Credits', {
                price: formatBillingAmount(Math.round(selectedPricePerMillion * 100), 'CNY', {
                  maximumFractionDigits: 2,
                  minimumFractionDigits: 2,
                }),
              })}{' '}
              {t('billingNative.credits.purchase.validity', '(valid for 6 months)')}
            </Text>
            <Text type={'success'}>
              <Trans
                i18nKey={'billingNative.credits.purchase.upgradeSaving'}
                ns={'subscription'}
                components={{
                  plan: <Link className={styles.inlineLink} to="/settings/plans" />,
                }}
                values={{
                  amount: formatBillingAmount(100, 'CNY', {
                    maximumFractionDigits: 2,
                    minimumFractionDigits: 2,
                  }),
                  planName: t('billingNative.plans.planName.starter', 'Starter'),
                }}
              />
            </Text>
          </Flexbox>

          {createOrderError ? (
            <Text type={'danger'}>
              {t(
                'billingNative.paymentStatus.createFailed',
                'Failed to create the order. Please try again later.',
              )}
            </Text>
          ) : null}
          {isPaymentSuccessful ? (
            <Text type={'success'}>
              {t(
                'billingNative.paymentStatus.success',
                'Payment successful. Credits have been added.',
              )}
            </Text>
          ) : null}

          <Flexbox
            horizontal
            align={'center'}
            className={styles.buyFooter}
            gap={16}
            justify={'space-between'}
          >
            <Flexbox horizontal align={'baseline'} gap={8}>
              <Text weight={700}>{t('billingNative.credits.purchase.total', 'Total')}</Text>
              <Text fontSize={24} weight={800}>
                {formatBillingAmount(totalAmountCents, 'CNY', {
                  maximumFractionDigits: 1,
                  minimumFractionDigits: 1,
                })}
              </Text>
            </Flexbox>
            <Button
              className={styles.autoTopUpAction}
              icon={<Icon icon={ShoppingCartIcon} />}
              loading={isCreatingOrder}
              type={'primary'}
              onClick={() => setIsPaymentChannelModalOpen(true)}
            >
              {t('billingNative.credits.purchase.buyNow', 'Buy Now')}
            </Button>
          </Flexbox>
        </Flexbox>
      </Flexbox>

      <Flexbox gap={18}>
        <Flexbox className={styles.sectionTitleBand} gap={4} justify={'center'}>
          <Text weight={700}>{t('credits.costEstimateHint.title', 'Cost Estimate Alert')}</Text>
          <Text type={'secondary'}>
            {t(
              'credits.costEstimateHint.desc',
              'Show a lightweight warning before sending when the estimated model cost reaches your threshold',
            )}
          </Text>
        </Flexbox>
        <Flexbox
          horizontal
          align={'center'}
          className={styles.sectionShell}
          justify={'space-between'}
          padding={16}
        >
          <Text weight={700}>{t('credits.costEstimateHint.threshold', 'Warning Threshold')}</Text>
          <InputNumber
            className={styles.warningInput}
            controls={false}
            defaultValue={2}
            min={0}
            suffix={<span className={styles.inputAffix}>M</span>}
          />
        </Flexbox>
      </Flexbox>

      <Flexbox gap={18}>
        <Flexbox className={styles.sectionTitleBand} gap={4} justify={'center'}>
          <Text weight={700}>{t('credits.autoTopUp.title', 'Auto Top-Up')}</Text>
          <Text type={'secondary'}>
            {t('credits.autoTopUp.desc', 'Ensure your credits never run out')}
          </Text>
        </Flexbox>
        <Flexbox
          horizontal
          align={'center'}
          className={`${styles.sectionShell} ${styles.autoTopUpBody}`}
          gap={16}
          padding={16}
          wrap={'wrap'}
        >
          <Text weight={700}>
            {t(
              'credits.autoTopUp.noCustomerHint',
              'Purchase credits once to save a payment method before enabling auto top-up.',
            )}
          </Text>
          <Button className={styles.autoTopUpAction} type={'primary'}>
            {t('credits.autoTopUp.purchaseCredits', 'Purchase Credits')}
          </Button>
        </Flexbox>
      </Flexbox>

      <Flexbox gap={18}>
        <Flexbox
          horizontal
          align={'center'}
          className={styles.packageHeader}
          gap={16}
          justify={'space-between'}
        >
          <Text fontSize={18} weight={700}>
            {t('billingNative.credits.packages.title', 'My Credits Packages')}
          </Text>
          <Flexbox horizontal align={'center'} gap={8} wrap={'wrap'}>
            <Select
              className={styles.filterSelect}
              value={sourceFilter}
              options={[
                {
                  label: t('billingNative.credits.packages.allSources', 'All Sources'),
                  value: 'all',
                },
                {
                  label: t('billingNative.grantSource.subscription', 'Subscription'),
                  value: 'subscription',
                },
                { label: t('billingNative.grantSource.top_up', 'Top-up'), value: 'top_up' },
                { label: t('billingNative.grantSource.trial', 'Trial'), value: 'trial' },
                {
                  label: t('billingNative.grantSource.admin_grant', 'Admin Grant'),
                  value: 'admin_grant',
                },
              ]}
              onChange={(value) => setSourceFilter(value)}
            />
            <Select
              className={styles.filterSelect}
              value={sortFilter}
              options={[
                {
                  label: t('billingNative.credits.packages.sortNewest', 'Newest'),
                  value: 'newest',
                },
                {
                  label: t('billingNative.credits.packages.sortExpiring', 'Expiring Soon'),
                  value: 'expiring',
                },
              ]}
              onChange={(value) => setSortFilter(value)}
            />
          </Flexbox>
        </Flexbox>

        <Flexbox className={styles.sectionShell}>
          <Flexbox
            horizontal
            align={'center'}
            className={styles.tabBar}
            gap={14}
            paddingBlock={16}
            paddingInline={22}
            ref={packageTabBarRef}
          >
            {(['active', 'depleted', 'expired'] as PackageTab[]).map((tab) => {
              const count =
                grantSummary?.packages.filter((grant) => getPackageTab(grant) === tab).length ?? 0;

              return (
                <Button
                  className={styles.tabButton}
                  data-active={packageTab === tab}
                  data-package-tab={tab}
                  key={tab}
                  type={'text'}
                  onClick={() => setPackageTab(tab)}
                >
                  {t(`billingNative.credits.packages.tab.${tab}`, tab)} ({count})
                </Button>
              );
            })}
            <div
              className={styles.tabIndicator}
              style={{
                opacity: tabIndicator.opacity,
                transform: `translateX(${tabIndicator.x}px)`,
                width: tabIndicator.width,
              }}
            />
          </Flexbox>

          <Flexbox className={styles.grantList}>
            {visiblePackages.length > 0 ? (
              visiblePackages.map((grant) => (
                <Flexbox
                  horizontal
                  align={'center'}
                  className={styles.grantItem}
                  gap={14}
                  justify={'space-between'}
                  key={grant.id}
                >
                  <Flexbox horizontal align={'center'} gap={12}>
                    <Icon icon={BoxIcon} size={28} style={{ color: cssVar.colorTextSecondary }} />
                    <Flexbox gap={4}>
                      <Flexbox horizontal align={'center'} gap={8} wrap={'wrap'}>
                        <Text weight={700}>
                          {t(`billingNative.grantSource.${grant.source}`, grant.source)}
                        </Text>
                        <Tag size={'small'}>
                          {t(`billingNative.status.grant.${grant.status}`, grant.status)}
                        </Tag>
                      </Flexbox>
                      <Text type={'secondary'}>
                        {grant.expiresAt
                          ? t('billingNative.credits.packages.expiresAt', 'Expires {{date}}', {
                              date: new Date(grant.expiresAt).toLocaleDateString(),
                            })
                          : t('billingNative.credits.packages.noExpiry', 'No expiry')}
                      </Text>
                    </Flexbox>
                  </Flexbox>
                  <Flexbox horizontal align={'center'} gap={12}>
                    <Flexbox align={'flex-end'}>
                      <CreditAmount value={grant.remainingCredits} />
                      <Text type={'secondary'}>
                        {t('billingNative.credits.packages.remainingOfTotal', 'of {{total}}', {
                          total: formatMillionAmount(grant.totalCredits),
                        })}
                      </Text>
                    </Flexbox>
                    <Icon
                      icon={ChevronRightIcon}
                      size={16}
                      style={{ color: cssVar.colorTextTertiary }}
                    />
                  </Flexbox>
                </Flexbox>
              ))
            ) : (
              <Empty
                icon={WalletCardsIcon}
                title={t('billingNative.credits.packages.emptyTitle', 'No Credits packages yet')}
                description={t(
                  'billingNative.credits.packages.emptyDesc',
                  'Purchase your first Credits package',
                )}
              />
            )}
          </Flexbox>
        </Flexbox>
      </Flexbox>

      <Flexbox horizontal align={'center'} gap={12} justify={'space-between'} wrap={'wrap'}>
        <Flexbox horizontal align={'center'} gap={8}>
          <StatusTag status={balance.status} type={'account'} />
          <Text type={'secondary'}>
            {t('billingNative.credits.availableTotal', '{{credits}} Credits available', {
              credits: formatNumber(totalAvailableCredits),
            })}
          </Text>
        </Flexbox>
        <Button
          icon={<Icon icon={RefreshCwIcon} />}
          size={'small'}
          onClick={() => void Promise.all([mutateBalance(), mutateGrants()])}
        >
          {t('billingNative.credits.refresh', 'Refresh')}
        </Button>
      </Flexbox>

      <PaymentChannelModal
        open={isPaymentChannelModalOpen}
        onOpenChange={setIsPaymentChannelModalOpen}
        onSelect={(selectedChannel) => void handleCreateOrder(selectedChannel)}
      />
      {createdOrder ? (
        <PaymentQrCodeModal
          amountCents={createdOrder.order.amountCents}
          currency={createdOrder.order.currency}
          open={isPaymentQrCodeModalOpen}
          orderId={createdOrder.order.id}
          qrCodeUrl={createdOrder.payment.qrCodeUrl ?? createdOrder.payment.paymentUrl}
          refreshing={isCreatingOrder}
          status={paymentQrCodeStatus}
          onOpenChange={setIsPaymentQrCodeModalOpen}
          onRefresh={() => void handleRefreshQrCode()}
        />
      ) : null}
    </Flexbox>
  );
});

Credits.displayName = 'Credits';
export default Credits;
