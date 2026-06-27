'use client';

import { createStaticStyles } from 'antd-style';
import { ArrowRightIcon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { CORE_PRODUCTS } from '../const';
import { useExploreNavigate } from '../useExploreNavigate';

const styles = createStaticStyles(({ css }) => ({
  arrow: css`
    position: absolute;
    inset-block-end: 30px;
    inset-inline-end: 23px;

    display: flex;
    align-items: center;
    justify-content: center;

    width: 18px;
    height: 18px;
    border-radius: 50%;

    color: #0b54ff;
  `,
  card: css`
    cursor: pointer;

    position: relative;

    overflow: visible;

    width: 226px;
    height: 257px;
    padding-block: 29px;
    padding-inline: 26px;
    border: 1px solid #edf0f7;
    border-radius: 16px;

    background: #fff;
    box-shadow: 0 16px 34px rgb(35 46 90 / 10%);

    transition:
      transform 0.2s,
      box-shadow 0.2s;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 20px 42px rgb(35 46 90 / 14%);
    }

    @media (width <= 768px) {
      width: calc(50% - 8px);
      height: auto;
      min-height: 210px;
      padding-block-end: 52px;

      &:nth-child(5) {
        width: 100%;
        max-width: none;
      }
    }

    @media (width <= 400px) {
      width: 100%;
      max-width: 360px;
    }
  `,
  cardDesc: css`
    margin-block: 29px 0;
    margin-inline: auto;

    font-size: 14px;
    font-weight: 500;
    line-height: 1.8;
    color: #16213a;
    text-align: center;
  `,
  cardTitle: css`
    font-size: 17px;
    font-weight: 800;
    color: #0c1020;
    white-space: nowrap;
  `,
  grid: css`
    display: flex;
    flex-wrap: wrap;
    gap: 15px;
    justify-content: center;
  `,
  icon: css`
    width: 66px;
    height: 66px;
    object-fit: contain;
  `,
  topRow: css`
    display: flex;
    gap: 10px;
    align-items: center;
  `,
  root: css`
    width: 100%;
    padding-block: 43px 63px;
    padding-inline: 29px;
    background: #fff;
  `,
  sectionContent: css`
    width: 100%;
    max-width: 1196px;
    margin-inline: auto;
  `,
  sectionHeader: css`
    margin-block-end: 39px;
    text-align: center;
  `,
  sectionSubtitle: css`
    margin-block: 15px 0;
    margin-inline: 0;

    font-size: 16px;
    font-weight: 500;
    color: #202b44;
  `,
  sectionTitle: css`
    margin: 0;

    font-size: 28px;
    font-weight: 800;
    line-height: 1.25;
    color: #060912;
  `,
}));

const CoreProducts = memo(() => {
  const { t } = useTranslation('explore');
  const { goChat, goImage, goVideo } = useExploreNavigate();

  const handleClick = (key: string) => {
    if (key === 'chat' || key === 'more') goChat();
    else if (key === 'video') goVideo();
    else goImage();
  };

  return (
    <section className={styles.root}>
      <div className={styles.sectionContent}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>{t('products.section.title')}</h2>
          <p className={styles.sectionSubtitle}>{t('products.section.subtitle')}</p>
        </div>
        <div className={styles.grid}>
          {CORE_PRODUCTS.map(({ key, icon }) => {
            return (
              <div className={styles.card} key={key} onClick={() => handleClick(key)}>
                <div className={styles.topRow}>
                  <img alt="" className={styles.icon} src={icon} />
                  <div className={styles.cardTitle}>{t(`products.${key}.title`)}</div>
                </div>
                <div className={styles.cardDesc}>{t(`products.${key}.desc`)}</div>
                <div className={styles.arrow}>
                  <ArrowRightIcon size={18} strokeWidth={2.2} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
});

CoreProducts.displayName = 'ExploreCoreProducts';
export default CoreProducts;
