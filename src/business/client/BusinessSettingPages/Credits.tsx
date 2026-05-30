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
import { Radio } from 'antd';
import { createStaticStyles, cssVar } from 'antd-style';
import {
  BoxIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  PencilIcon,
  ReceiptTextIcon,
  RefreshCwIcon,
  ShoppingCartIcon,
  WalletCardsIcon,
  WifiIcon,
} from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import type { TopUpProductId } from '@/business/shared/billingProducts';
import { TOP_UP_PRODUCTS } from '@/business/shared/billingProducts';
import UserAvatar from '@/features/User/UserAvatar';
import { billingService } from '@/services/billing';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';
import { formatNumber } from '@/utils/format';

import CreditAmount from './components/CreditAmount';
import StatusTag from './components/StatusTag';
import {
  refreshBillingOrders,
  useBillingBalance,
  useBillingGrantPackages,
  useBillingOrder,
  useCurrentSubscription,
} from './hooks/useBillingData';
import { billingPageStyles as sharedStyles } from './styles';

type PaymentChannel = 'alipay' | 'wechat';
type PackageTab = 'active' | 'depleted' | 'expired';

interface CreatedTopUpOrder {
  order: Awaited<ReturnType<typeof billingService.createTopUpOrder>>['order'];
  payment: Awaited<ReturnType<typeof billingService.createTopUpOrder>>['payment'];
}

const MILLION = 1_000_000;
const CUSTOM_PRODUCT_ID = 'custom';

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
    border-color: transparent;
    border-radius: 8px;

    background: ${token.colorFillQuaternary};

    &:first-of-type {
      border-color: ${token.colorBorder};
      background: ${token.colorBgContainer};
    }

    @media (width <= 640px) {
      min-width: calc(33.333% - 8px);
    }
  `,
  customProductButton: css`
    min-width: 108px;
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
  tabButton: css`
    padding-block: 0 14px;
    padding-inline: 8px;
    border: none;
    border-block-end: 2px solid transparent;
    border-radius: 0;

    color: ${token.colorTextSecondary};

    background: transparent;

    &[data-active='true'] {
      border-block-end-color: ${token.colorText};
      color: ${token.colorText};
    }
  `,
  warningInput: css`
    width: 160px;
  `,
}));

const formatAmount = (amountCents: number, currency = 'CNY') =>
  `${currency === 'CNY' ? '$' : currency} ${(amountCents / 100).toLocaleString('en-US', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  })}`;

const formatMillionAmount = (credits: number) => {
  const value = credits / MILLION;

  return Number.isInteger(value) ? `${value}M` : `${value.toFixed(2)}M`;
};

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
  const [channel] = useState<PaymentChannel>('alipay');
  const [createdOrder, setCreatedOrder] = useState<CreatedTopUpOrder>();
  const [createOrderError, setCreateOrderError] = useState<string>();
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [productId, setProductId] = useState<TopUpProductId>(TOP_UP_PRODUCTS[0].id);
  const [selectedProduct, setSelectedProduct] = useState<TopUpProductId | typeof CUSTOM_PRODUCT_ID>(
    TOP_UP_PRODUCTS[0].id,
  );
  const [packageTab, setPackageTab] = useState<PackageTab>('active');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [sortFilter, setSortFilter] = useState('newest');
  const { data: polledOrder } = useBillingOrder(createdOrder?.order.id);

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
  const currentPlanName = currentSubscription?.planId
    ? t(`billingNative.plans.planName.${currentSubscription.planId}`, currentSubscription.planId)
    : t('billingNative.plans.free.name', 'Free');
  const currentPlanLabel = currentPlanName.toUpperCase();

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
    if (polledOrder?.status !== 'activated') return;

    void Promise.all([mutateBalance(), mutateGrants(), refreshBillingOrders()]);
  }, [mutateBalance, mutateGrants, polledOrder?.status]);

  const handleProductSelect = (value: TopUpProductId | typeof CUSTOM_PRODUCT_ID) => {
    setSelectedProduct(value);
    if (value === CUSTOM_PRODUCT_ID) return;
    setProductId(value);
  };

  const handleCreateOrder = async () => {
    setIsCreatingOrder(true);
    setCreateOrderError(undefined);

    try {
      const result = await billingService.createTopUpOrder({ channel, productId });
      setCreatedOrder(result);
      await refreshBillingOrders();
    } catch (error) {
      setCreateOrderError(error instanceof Error ? error.message : String(error));
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
              <Link to="/settings/usage">
                <Flexbox horizontal align={'center'} gap={6}>
                  <Icon color={cssVar.colorPrimary} icon={ReceiptTextIcon} size={14} />
                  <Text color={cssVar.colorPrimary}>
                    {t('billingNative.credits.balance.viewUsage', 'View Usage')}
                  </Text>
                </Flexbox>
              </Link>
              <Link to="/settings/billing">
                <Flexbox horizontal align={'center'} gap={6}>
                  <Icon color={cssVar.colorPrimary} icon={RefreshCwIcon} size={14} />
                  <Text color={cssVar.colorPrimary}>
                    {t('billingNative.credits.balance.topUpHistory', 'Top-up History')}
                  </Text>
                </Flexbox>
              </Link>
            </Flexbox>

            <Flexbox className={styles.balanceCard} justify={'space-between'}>
              <Flexbox horizontal align={'center'} justify={'space-between'}>
                <Text className={styles.paymentCardBrand}>
                  {t('billingNative.credits.card.brand', 'LobeHub Cloud Subscription')}
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
                    {t('billingNative.credits.card.account', 'LobeHub account')}
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
                key={product.id}
                type={selectedProduct === product.id ? 'default' : 'text'}
                onClick={() => handleProductSelect(product.id)}
              >
                {product.name}
              </Button>
            ))}
            <Button
              className={`${styles.buyProductButton} ${styles.customProductButton}`}
              icon={<Icon icon={PencilIcon} />}
              type={selectedProduct === CUSTOM_PRODUCT_ID ? 'default' : 'text'}
              onClick={() => handleProductSelect(CUSTOM_PRODUCT_ID)}
            >
              {t('billingNative.credits.purchase.custom', 'Custom')}
            </Button>
          </Flexbox>

          {selectedProduct === CUSTOM_PRODUCT_ID ? (
            <Flexbox horizontal align={'center'} gap={10} wrap={'wrap'}>
              <InputNumber
                min={5}
                placeholder="5"
                suffix={<span className={styles.inputAffix}>M</span>}
                onChange={(value) => {
                  const credits = Number(value ?? 0) * MILLION;
                  const nearestProduct = TOP_UP_PRODUCTS.find(
                    (product) => product.credits === credits,
                  );
                  if (nearestProduct) setProductId(nearestProduct.id);
                }}
              />
              <Text type={'secondary'}>
                {t(
                  'billingNative.credits.purchase.customHint',
                  'Custom purchase currently uses the nearest listed package.',
                )}
              </Text>
            </Flexbox>
          ) : null}

          <Flexbox gap={8}>
            <Text type={'secondary'}>
              {t('billingNative.credits.purchase.pricePerMillion', '{{price}} / million Credits', {
                price: `$${selectedPricePerMillion.toFixed(2)}`,
              })}{' '}
              {t('billingNative.credits.purchase.validity', '(valid for 6 months)')}
            </Text>
            <Text type={'success'}>
              {t(
                'billingNative.credits.purchase.upgradeSaving',
                'Upgrade to Starter to save $1.00',
              )}
            </Text>
          </Flexbox>

          {createOrderError ? (
            <Text type={'danger'}>
              {t(
                'billingNative.credits.topUp.createOrderFailed',
                'Could not create the payment order. Check payment configuration and try again.',
              )}
            </Text>
          ) : null}

          {createdOrder ? (
            <Flexbox className={sharedStyles.card} gap={8} padding={12}>
              <Flexbox horizontal align={'center'} gap={8} wrap={'wrap'}>
                <Text weight={700}>
                  {t('billingNative.credits.topUp.pendingOrder', 'Pending payment order')}
                </Text>
                <StatusTag
                  status={polledOrder?.status ?? createdOrder.order.status}
                  type={'order'}
                />
              </Flexbox>
              <Text code>{createdOrder.order.id}</Text>
              <Text>
                {formatAmount(createdOrder.order.amountCents, createdOrder.order.currency)}
              </Text>
              {createdOrder.payment.qrCodeUrl || createdOrder.payment.paymentUrl ? (
                <a
                  href={createdOrder.payment.qrCodeUrl ?? createdOrder.payment.paymentUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <Flexbox horizontal align={'center'} gap={6}>
                    {t('billingNative.credits.topUp.openPayment', 'Open payment link')}
                    <Icon icon={ExternalLinkIcon} size={14} />
                  </Flexbox>
                </a>
              ) : null}
            </Flexbox>
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
                {formatAmount(currentProduct.amountCents)}
              </Text>
            </Flexbox>
            <Button
              className={styles.autoTopUpAction}
              icon={<Icon icon={ShoppingCartIcon} />}
              loading={isCreatingOrder}
              type={'primary'}
              onClick={() => void handleCreateOrder()}
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
          <Flexbox horizontal align={'center'} gap={18} paddingBlock={14} paddingInline={16}>
            {(['active', 'depleted', 'expired'] as PackageTab[]).map((tab) => {
              const count =
                grantSummary?.packages.filter((grant) => getPackageTab(grant) === tab).length ?? 0;

              return (
                <Button
                  className={styles.tabButton}
                  data-active={packageTab === tab}
                  key={tab}
                  type={'text'}
                  onClick={() => setPackageTab(tab)}
                >
                  {t(`billingNative.credits.packages.tab.${tab}`, tab)} ({count})
                </Button>
              );
            })}
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
    </Flexbox>
  );
});

Credits.displayName = 'Credits';
export default Credits;
