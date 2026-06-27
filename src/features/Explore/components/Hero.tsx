'use client';

import { BRANDING_NAME } from '@lobechat/business-const';
import { createStaticStyles } from 'antd-style';
import { ArrowRightIcon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { useExploreNavigate } from '../useExploreNavigate';

const styles = createStaticStyles(({ css }) => ({
  badge: css`
    display: inline-block;

    width: 180px;
    height: 34px;
    padding-block: 7px;
    padding-inline: 20px;
    border-radius: 999px;

    font-size: 15px;
    font-weight: 700;
    line-height: 20px;
    color: #0956ff;
    white-space: nowrap;

    background: #e4e9ff;
  `,
  btnOutline: css`
    cursor: pointer;

    display: flex;
    gap: 6px;
    align-items: center;
    justify-content: center;

    width: 174px;
    height: 50px;
    border: 1.5px solid #0b54ff;
    border-radius: 999px;

    font-size: 15px;
    font-weight: 700;
    color: #0b54ff;

    background: rgb(255 255 255 / 75%);

    transition: border-color 0.2s;

    &:hover {
      border-color: #0047ed;
      color: #0047ed;
    }
  `,
  btnPrimary: css`
    cursor: pointer;

    display: flex;
    gap: 6px;
    align-items: center;
    justify-content: center;

    width: 170px;
    height: 50px;
    border: none;
    border-radius: 999px;

    font-size: 15px;
    font-weight: 700;
    color: #fff;

    background: #0757ff;
    box-shadow: 0 16px 30px rgb(7 87 255 / 20%);

    transition: opacity 0.2s;

    &:hover {
      opacity: 0.88;
    }
  `,
  buttons: css`
    display: flex;
    gap: 18px;
    align-items: center;
    margin-block-start: 35px;
  `,
  heroImage: css`
    pointer-events: none;
    user-select: none;

    flex: 1 1 auto;

    aspect-ratio: 752 / 558;
    min-width: 0;
    max-width: 640px;
    height: auto;

    object-fit: cover;
    object-position: 50% 50%;

    mask-composite: intersect;
    mask-image:
      linear-gradient(to right, transparent 0%, black 18%, black 82%, transparent 100%),
      linear-gradient(to bottom, transparent 0%, black 8%, black 90%, transparent 100%);

    @media (width <= 960px) {
      flex: 0 0 auto;
      width: 100%;
      max-width: 100%;
    }
  `,
  left: css`
    position: relative;
    z-index: 1;

    display: flex;
    flex: 0 0 auto;
    flex-direction: column;

    width: 475px;

    @media (width <= 960px) {
      width: 100%;
    }
  `,
  root: css`
    position: relative;

    overflow: hidden;
    display: flex;
    gap: 48px;
    align-items: center;

    width: 100%;
    max-width: 1254px;
    margin-inline: auto;
    padding-block: 56px;
    padding-inline: 80px;

    @media (width <= 1100px) {
      gap: 36px;
      padding-block: 56px;
      padding-inline: 48px;
    }

    @media (width <= 960px) {
      flex-direction: column;
      gap: 32px;
      align-items: flex-start;

      padding-block: 56px 48px;
      padding-inline: 32px;
    }

    @media (width <= 480px) {
      gap: 24px;
      padding-block: 48px 40px;
      padding-inline: 20px;
    }
  `,
  subtitle: css`
    max-width: 455px;
    margin-block: 28px 0;
    margin-inline: 0;

    font-size: 19px;
    font-weight: 500;
    line-height: 1.75;
    color: #111827;

    @media (width <= 960px) {
      max-width: 100%;
    }
  `,
  title: css`
    margin-block: 38px 0;
    margin-inline: 0;

    font-size: 51px;
    font-weight: 800;
    line-height: 1.32;
    color: #080b18;
    letter-spacing: 0;

    @media (width >= 481px) and (width <= 960px) {
      font-size: clamp(51px, 7vw, 68px);
    }

    @media (width <= 480px) {
      font-size: clamp(32px, 9vw, 48px);
    }
  `,
  titleAccent: css`
    color: #0b54ff;
  `,
}));

const Hero = memo(() => {
  const { t } = useTranslation('explore');
  const { goChat } = useExploreNavigate();
  const titleLine1 = t('hero.title.line1');
  const titleLine1Rest = titleLine1.replace(/^AI/, '');

  return (
    <section
      style={{
        width: '100%',
        background: 'linear-gradient(110deg, #f7faff 0%, #f5f8ff 48%, #eef6ff 100%)',
      }}
    >
      <div className={styles.root}>
        <div className={styles.left}>
          <span className={styles.badge}>{t('hero.badge')}</span>
          <h1 className={styles.title}>
            <span className={styles.titleAccent}>AI</span>
            {titleLine1Rest}
            <br />
            {t('hero.title.line2')}
          </h1>
          <p className={styles.subtitle}>{t('hero.subtitle', { name: BRANDING_NAME })}</p>
          <div className={styles.buttons}>
            <button className={styles.btnPrimary} onClick={goChat}>
              {t('hero.cta.primary')} <ArrowRightIcon size={16} />
            </button>
            <button className={styles.btnOutline} onClick={goChat}>
              {t('hero.cta.secondary')}
            </button>
          </div>
        </div>
        <img alt="hero" className={styles.heroImage} src="/images/index_hero_right.png" />
      </div>
    </section>
  );
});

Hero.displayName = 'ExploreHero';
export default Hero;
