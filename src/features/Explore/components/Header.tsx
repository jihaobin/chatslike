'use client';

import { createStaticStyles } from 'antd-style';
import { ChevronDownIcon, MenuIcon, XIcon } from 'lucide-react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ProductLogo } from '@/components/Branding';

import LanguageDropdown from './LanguageDropdown';

const styles = createStaticStyles(({ css, cssVar }) => ({
  cta: css`
    cursor: pointer;

    width: 120px;
    height: 52px;
    border: none;
    border-radius: 999px;

    font-size: 15px;
    font-weight: 700;
    color: #fff;
    white-space: nowrap;

    background: #0757ff;
    box-shadow: 0 14px 30px rgb(7 87 255 / 18%);

    transition: opacity 0.2s;

    &:hover {
      opacity: 0.85;
    }

    @media (width <= 768px) {
      width: 100px;
      height: 44px;
      font-size: 14px;
    }
  `,
  drawer: css`
    width: 100%;
    padding-block: 8px 20px;
    padding-inline: 0;
    border-block-start: 1px solid rgb(0 0 0 / 7%);

    background: linear-gradient(110deg, #f7faff 0%, #f5f8ff 48%, #eef6ff 100%);

    @media (width >= 769px) {
      display: none;
    }
  `,
  drawerItem: css`
    cursor: pointer;

    display: flex;
    gap: 5px;
    align-items: center;

    padding-block: 13px;
    padding-inline: 24px;

    font-size: 15px;
    font-weight: 700;
    color: #111827;

    &:hover {
      color: ${cssVar.colorText};
    }
  `,
  hamburger: css`
    cursor: pointer;

    display: none;
    align-items: center;
    justify-content: center;

    width: 40px;
    height: 40px;
    border: none;

    color: #111827;

    background: none;

    @media (width <= 768px) {
      display: flex;
    }
  `,
  lang: css`
    cursor: pointer;

    display: flex;
    gap: 6px;
    align-items: center;
    justify-content: center;

    width: 94px;
    height: 40px;
    border-radius: 999px;

    font-size: 15px;
    font-weight: 700;
    color: #111827;
    white-space: nowrap;

    background: rgb(255 255 255 / 65%);

    transition: color 0.15s;

    &:hover {
      color: ${cssVar.colorText};
    }
  `,
  nav: css`
    display: flex;
    flex: 1;
    gap: 31px;
    align-items: center;
    justify-content: center;

    @media (width <= 768px) {
      display: none;
    }
  `,
  navItem: css`
    display: flex;
    gap: 5px;
    align-items: center;

    padding-block: 6px;
    padding-inline: 0;
    border-radius: 8px;

    font-size: 15px;
    font-weight: 700;
    color: #111827;
    white-space: nowrap;

    transition: color 0.15s;

    &:hover {
      color: ${cssVar.colorText};
    }
  `,
  right: css`
    display: flex;
    gap: 12px;
    align-items: center;

    @media (width <= 768px) {
      gap: 8px;
    }
  `,
  root: css`
    z-index: 100;
    width: 100%;
    background: linear-gradient(110deg, #f7faff 0%, #f5f8ff 48%, #eef6ff 100%);
  `,
  rootInner: css`
    display: flex;
    align-items: center;

    width: 100%;
    max-width: 1254px;
    height: 100px;
    margin-inline: auto;
    padding-inline: 33px 8px;

    @media (width <= 768px) {
      justify-content: space-between;
      height: 72px;
      padding-inline: 20px;
    }
  `,
}));

const Header = memo(() => {
  const { t } = useTranslation('explore');
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className={styles.root}>
      <div className={styles.rootInner}>
        <ProductLogo size={40} type={'combine'} />

        <nav className={styles.nav}>
          <div className={styles.navItem} style={{ color: '#0B54FF' }}>
            {t('nav.home')}
          </div>
          <div className={styles.navItem}>
            {t('nav.products')}
            <ChevronDownIcon size={14} strokeWidth={2.4} />
          </div>
          <div className={styles.navItem}>{t('nav.solutions')}</div>
          <div className={styles.navItem}>{t('nav.cases')}</div>
          <div className={styles.navItem}>{t('nav.aiCustom')}</div>
          <div className={styles.navItem}>{t('nav.about')}</div>
          <div className={styles.navItem}>{t('nav.news')}</div>
        </nav>

        <div className={styles.right}>
          <LanguageDropdown />
          <button className={styles.cta} type="button">
            {t('nav.contact')}
          </button>
          <button
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            className={styles.hamburger}
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? (
              <XIcon size={22} strokeWidth={2} />
            ) : (
              <MenuIcon size={22} strokeWidth={2} />
            )}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className={styles.drawer}>
          <div className={styles.drawerItem} style={{ color: '#0B54FF' }}>
            {t('nav.home')}
          </div>
          <div className={styles.drawerItem}>
            {t('nav.products')}
            <ChevronDownIcon size={14} strokeWidth={2.4} />
          </div>
          <div className={styles.drawerItem}>{t('nav.solutions')}</div>
          <div className={styles.drawerItem}>{t('nav.cases')}</div>
          <div className={styles.drawerItem}>{t('nav.aiCustom')}</div>
          <div className={styles.drawerItem}>{t('nav.about')}</div>
          <div className={styles.drawerItem}>{t('nav.news')}</div>
        </div>
      )}
    </header>
  );
});

Header.displayName = 'ExploreHeader';
export default Header;
