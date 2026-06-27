'use client';

import { BRANDING_NAME } from '@lobechat/business-const';
import { createStaticStyles } from 'antd-style';
import { ArrowRightIcon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { useExploreNavigate } from '../useExploreNavigate';

const styles = createStaticStyles(({ css }) => ({
  btnLearn: css`
    cursor: pointer;

    width: 144px;
    height: 44px;
    border: none;
    border-radius: 999px;

    font-size: 15px;
    font-weight: 800;
    color: #0b54ff;

    background: #fff;

    transition: opacity 0.2s;

    &:hover {
      opacity: 0.92;
    }

    @media (width <= 480px) {
      width: 120px;
      font-size: 14px;
    }
  `,
  btnStart: css`
    cursor: pointer;

    display: flex;
    gap: 6px;
    align-items: center;
    justify-content: center;

    width: 143px;
    height: 44px;
    border: none;
    border-radius: 999px;

    font-size: 15px;
    font-weight: 800;
    color: #fff;

    background: #0757ff;

    transition: opacity 0.2s;

    &:hover {
      opacity: 0.9;
    }

    @media (width <= 480px) {
      width: 120px;
      font-size: 14px;
    }
  `,
  buttons: css`
    display: flex;
    flex-shrink: 0;
    gap: 14px;
    align-items: center;
    justify-content: center;

    @media (width <= 768px) {
      width: 100%;
    }

    @media (width <= 480px) {
      flex-wrap: wrap;
      gap: 10px;
    }
  `,
  root: css`
    width: 100%;
    height: 88px;
    background: linear-gradient(100deg, #07122e 0%, #102675 48%, #082fff 100%);

    @media (width <= 768px) {
      height: auto;
    }
  `,
  rootInner: css`
    display: flex;
    gap: 32px;
    align-items: center;
    justify-content: space-between;

    width: 100%;
    max-width: 1254px;
    height: 100%;
    margin-inline: auto;
    padding-inline: 49px;

    @media (width <= 768px) {
      flex-direction: column;
      gap: 24px;
      align-items: center;

      padding-block: 32px;
      padding-inline: 24px;

      text-align: center;
    }

    @media (width <= 480px) {
      gap: 20px;
      padding-block: 28px;
      padding-inline: 20px;
    }
  `,
  text: css`
    min-width: 0;

    @media (width <= 768px) {
      width: 100%;
      max-width: 520px;
    }
  `,
  subtitle: css`
    margin-block: 7px 0;
    margin-inline: 0;

    font-size: 14px;
    font-weight: 500;
    color: rgb(255 255 255 / 70%);

    @media (width <= 768px) {
      margin-block-start: 8px;
      font-size: 13px;
      line-height: 1.6;
    }
  `,
  title: css`
    margin: 0;

    font-size: 25px;
    font-weight: 800;
    line-height: 1.3;
    color: #fff;

    @media (width <= 768px) {
      font-size: 22px;
      line-height: 1.4;
    }

    @media (width <= 480px) {
      font-size: 19px;
      line-height: 1.45;
    }
  `,
}));

const CTABanner = memo(() => {
  const { t } = useTranslation('explore');
  const { goChat } = useExploreNavigate();

  return (
    <section className={styles.root}>
      <div className={styles.rootInner}>
        <div className={styles.text}>
          <h2 className={styles.title}>{t('cta.title')}</h2>
          <p className={styles.subtitle}>{t('cta.subtitle', { name: BRANDING_NAME })}</p>
        </div>
        <div className={styles.buttons}>
          <button className={styles.btnLearn} type="button" onClick={goChat}>
            {t('cta.learn')}
          </button>
          <button className={styles.btnStart} type="button" onClick={goChat}>
            {t('cta.start')} <ArrowRightIcon size={15} strokeWidth={2.4} />
          </button>
        </div>
      </div>
    </section>
  );
});

CTABanner.displayName = 'ExploreCTABanner';
export default CTABanner;
