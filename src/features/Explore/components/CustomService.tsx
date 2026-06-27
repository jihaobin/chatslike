'use client';

import { createStaticStyles } from 'antd-style';
import { Code2Icon, CpuIcon, HeadphonesIcon, ShieldIcon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { CUSTOM_FEATURES } from '../const';

const ICONS = {
  api: Code2Icon,
  deploy: ShieldIcon,
  model: CpuIcon,
  support: HeadphonesIcon,
};

const styles = createStaticStyles(({ css }) => ({
  featureDesc: css`
    margin-block: 6px 0;
    margin-inline: 0;

    font-size: 12px;
    font-weight: 500;
    line-height: 1.5;
    color: #27324c;
  `,
  featureItem: css`
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;

    @media (width <= 768px) {
      flex: 0 0 calc(50% - 8px);
      min-width: calc(50% - 8px);
    }
  `,
  featureTitle: css`
    font-size: 15px;
    font-weight: 800;
    color: #090d18;
  `,
  grid: css`
    display: flex;
    gap: 40px;
    align-items: flex-start;

    @media (width <= 768px) {
      flex-wrap: wrap;
      gap: 20px 16px;
    }
  `,
  iconBox: css`
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;

    width: 46px;
    height: 46px;
    margin-block-end: 10px;
    border-radius: 999px;
  `,
  illustration: css`
    pointer-events: none;
    user-select: none;

    position: absolute;
    inset-block-end: 0;
    inset-inline-end: 19px;

    width: 289px;
    height: 181px;

    object-fit: cover;

    @media (width <= 960px) {
      width: 220px;
      height: 138px;
    }

    @media (width <= 768px) {
      display: none;
    }
  `,
  root: css`
    width: 100%;
    min-height: 250px;
    background: linear-gradient(100deg, #f4f7ff 0%, #f8fbff 48%, #edf4ff 100%);
  `,
  row: css`
    position: relative;

    width: 100%;
    max-width: 1254px;
    margin-inline: auto;
    padding-block: 73px 36px;
    padding-inline: 45px 320px;

    @media (width <= 960px) {
      padding-block: 73px 36px;
      padding-inline: 45px 260px;
    }

    @media (width <= 768px) {
      padding-block: 20px 40px;
      padding-inline: 20px;
    }
  `,
  sectionHeader: css`
    position: absolute;
    inset-block-start: 19px;
    inset-inline-start: 0;

    width: 100%;

    text-align: center;

    @media (width <= 768px) {
      position: static;
      margin-block-end: 20px;
      text-align: center;
    }
  `,
  sectionSubtitle: css`
    margin-block: 10px 0;
    margin-inline: 0;

    font-size: 12px;
    font-weight: 600;
    color: #202b44;
  `,
  sectionTitle: css`
    margin: 0;

    font-size: 26px;
    font-weight: 800;
    line-height: 1.25;
    color: #060912;
  `,
}));

const CustomService = memo(() => {
  const { t } = useTranslation('explore');

  return (
    <section className={styles.root}>
      <div className={styles.row}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>{t('custom.section.title')}</h2>
          <p className={styles.sectionSubtitle}>{t('custom.section.subtitle')}</p>
        </div>

        <div className={styles.grid}>
          {CUSTOM_FEATURES.map(({ key, iconBg, iconColor }) => {
            const Icon = ICONS[key as keyof typeof ICONS];
            return (
              <div className={styles.featureItem} key={key}>
                <div className={styles.iconBox} style={{ background: iconBg }}>
                  <Icon color={iconColor} size={22} strokeWidth={2.2} />
                </div>
                <div className={styles.featureTitle}>{t(`custom.${key}.title`)}</div>
                <div className={styles.featureDesc}>{t(`custom.${key}.desc`)}</div>
              </div>
            );
          })}
        </div>
        <img alt="" className={styles.illustration} src="/images/explore/custom-platform.png" />
      </div>
    </section>
  );
});

CustomService.displayName = 'ExploreCustomService';
export default CustomService;
