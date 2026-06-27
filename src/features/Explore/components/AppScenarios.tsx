'use client';

import { createStaticStyles } from 'antd-style';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { APP_SCENARIOS } from '../const';

const styles = createStaticStyles(({ css }) => ({
  card: css`
    width: 181px;

    @media (width <= 768px) {
      width: calc(33.333% - 11px);
    }

    @media (width <= 500px) {
      width: calc(50% - 8px);
    }
  `,
  cardDesc: css`
    margin-block: 10px 0;
    margin-inline: 0;

    font-size: 12px;
    font-weight: 600;
    line-height: 1.7;
    color: #172033;
  `,
  cardImage: css`
    display: block;

    width: 181px;
    height: 120px;
    border-radius: 10px;

    object-fit: cover;
    box-shadow: 0 10px 24px rgb(23 37 84 / 10%);

    @media (width <= 768px) {
      aspect-ratio: 181 / 120;
      width: 100%;
      height: auto;
    }
  `,
  cardTitle: css`
    margin-block-start: 13px;
    font-size: 16px;
    font-weight: 800;
    color: #090d18;
  `,
  grid: css`
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    justify-content: center;
  `,
  indicator: css`
    display: flex;
    gap: 0;
    align-items: center;
    justify-content: center;

    margin-block-start: 33px;
  `,
  indicatorActive: css`
    width: 48px;
    height: 3px;
    border-radius: 999px;
    background: #0757ff;
  `,
  indicatorMuted: css`
    width: 94px;
    height: 3px;
    border-radius: 999px;
    background: #edf1f8;
  `,
  root: css`
    width: 100%;
    padding-block: 18px 32px;
    padding-inline: 36px;
    background: #fff;
  `,
  sectionContent: css`
    width: 100%;
    max-width: 1180px;
    margin-inline: auto;
  `,
  sectionHeader: css`
    margin-block-end: 25px;
    text-align: center;
  `,
  sectionSubtitle: css`
    margin-block: 13px 0;
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

const AppScenarios = memo(() => {
  const { t } = useTranslation('explore');

  return (
    <section className={styles.root}>
      <div className={styles.sectionContent}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>{t('scenarios.section.title')}</h2>
          <p className={styles.sectionSubtitle}>{t('scenarios.section.subtitle')}</p>
        </div>
        <div className={styles.grid}>
          {APP_SCENARIOS.map(({ key, image }) => {
            return (
              <div className={styles.card} key={key}>
                <img alt="" className={styles.cardImage} src={image} />
                <div className={styles.cardTitle}>{t(`scenarios.${key}.title`)}</div>
                <div className={styles.cardDesc}>{t(`scenarios.${key}.desc`)}</div>
              </div>
            );
          })}
        </div>
        <div aria-hidden className={styles.indicator}>
          <span className={styles.indicatorActive} />
          <span className={styles.indicatorMuted} />
        </div>
      </div>
    </section>
  );
});

AppScenarios.displayName = 'ExploreAppScenarios';
export default AppScenarios;
