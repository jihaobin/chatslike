'use client';

import { BRANDING_NAME } from '@lobechat/business-const';
import { Icon } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { LinkIcon, MailIcon, MessageCircleIcon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { ProductLogo } from '@/components/Branding';

const LINKS = {
  about: ['公司介绍', '团队介绍', '加入我们', '联系我们'],
  custom: ['模型定制', 'API 接入', '私有化部署', '技术支持'],
  products: ['文本生成图片', 'AI 聊天', '图生图', '视频生成', '更多能力'],
  solutions: ['营销广告', '电商运营', '内容创作', '教育培训', '游戏娱乐', '设计行业'],
  support: ['帮助中心', '隐私政策', '服务条款'],
};

const styles = createStaticStyles(({ css }) => ({
  bottom: css`
    margin-block-start: 35px;
    padding-block-start: 24px;
    border-block-start: 1px solid rgb(255 255 255 / 10%);

    font-size: 13px;
    color: rgb(255 255 255 / 40%);
    text-align: center;
  `,
  col: css`
    display: flex;
    flex-direction: column;
    gap: 11px;
  `,
  colTitle: css`
    margin-block-end: 6px;
    font-size: 14px;
    font-weight: 800;
    color: rgb(255 255 255 / 92%);
  `,
  desc: css`
    max-width: 232px;
    margin-block: 12px 0;
    margin-inline: 0;

    font-size: 13px;
    font-weight: 500;
    line-height: 1.85;
    color: rgb(255 255 255 / 64%);
  `,
  grid: css`
    display: grid;
    grid-template-columns: 260px repeat(5, 1fr);
    gap: 54px;

    @media (width <= 960px) {
      grid-template-columns: repeat(3, 1fr);
      gap: 32px;
    }

    @media (width <= 600px) {
      grid-template-columns: repeat(2, 1fr);
      gap: 24px;
    }

    @media (width <= 380px) {
      grid-template-columns: 1fr;
    }
  `,
  link: css`
    cursor: pointer;

    font-size: 13px;
    font-weight: 500;
    line-height: 1.05;
    color: rgb(255 255 255 / 60%);

    transition: color 0.15s;

    &:hover {
      color: rgb(255 255 255 / 90%);
    }
  `,
  logoWrap: css`
    filter: brightness(0) invert(1);
  `,
  root: css`
    width: 100%;
    padding-block: 38px 32px;
    padding-inline: 45px;
    background: radial-gradient(circle at 10% 0%, rgb(36 82 154 / 28%), transparent 34%), #071426;
  `,
  rootContent: css`
    width: 100%;
    max-width: 1164px;
    margin-inline: auto;
  `,
  social: css`
    display: flex;
    gap: 16px;
    margin-block-start: 22px;
  `,
  socialItem: css`
    display: flex;
    align-items: center;
    justify-content: center;

    width: 36px;
    height: 36px;
    border-radius: 999px;

    color: rgb(255 255 255 / 90%);

    background: rgb(255 255 255 / 8%);
  `,
}));

const ExploreFooter = memo(() => {
  const { t } = useTranslation('explore');

  return (
    <footer className={styles.root}>
      <div className={styles.rootContent}>
        <div className={styles.grid}>
          {/* Brand column */}
          <div className={styles.col}>
            <div className={styles.logoWrap}>
              <ProductLogo size={38} type={'combine'} />
            </div>
            <p className={styles.desc}>{t('footer.desc')}</p>
            <div className={styles.social}>
              <span className={styles.socialItem}>
                <Icon icon={LinkIcon} size={15} />
              </span>
              <span className={styles.socialItem}>
                <Icon icon={MessageCircleIcon} size={15} />
              </span>
              <span className={styles.socialItem}>
                <Icon icon={MailIcon} size={15} />
              </span>
            </div>
          </div>

          {/* Link columns */}
          {(
            [
              ['products', t('footer.products.title')],
              ['solutions', t('footer.solutions.title')],
              ['custom', t('footer.custom.title')],
              ['about', t('footer.about.title')],
              ['support', t('footer.support.title')],
            ] as const
          ).map(([key, title]) => (
            <div className={styles.col} key={key}>
              <div className={styles.colTitle}>{title}</div>
              {LINKS[key].map((label) => (
                <span className={styles.link} key={label}>
                  {label}
                </span>
              ))}
            </div>
          ))}
        </div>

        <div className={styles.bottom}>{t('footer.copyright', { name: BRANDING_NAME })}</div>
      </div>
    </footer>
  );
});

ExploreFooter.displayName = 'ExploreFooter';
export default ExploreFooter;
