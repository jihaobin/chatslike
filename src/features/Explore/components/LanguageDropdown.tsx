'use client';

import { DropdownMenu, type DropdownMenuCheckboxItem, Flexbox, Icon, Text } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { ChevronDownIcon, GlobeIcon } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { localeOptions, normalizeLocale } from '@/locales/resources';
import { useGlobalStore } from '@/store/global';
import { globalGeneralSelectors } from '@/store/global/selectors';

const styles = createStaticStyles(({ css }) => ({
  trigger: css`
    cursor: pointer;

    display: inline-flex;
    gap: 8px;
    align-items: center;

    height: 40px;
    padding-inline: 14px;
    border: 1px solid rgb(11 84 255 / 14%);
    border-radius: 999px;

    color: ${cssVar.colorTextSecondary};
    white-space: nowrap;

    background: rgb(255 255 255 / 78%);

    transition:
      background 0.2s,
      color 0.2s,
      border-color 0.2s;

    &:hover {
      border-color: rgb(11 84 255 / 24%);
      color: ${cssVar.colorText};
      background: #fff;
    }
  `,
  label: css`
    min-width: 0;
    font-size: 14px;
    font-weight: 700;
    color: ${cssVar.colorText};
  `,
  popup: css`
    overflow: auto;
    min-width: 264px;
    max-height: 360px;
  `,
  secondary: css`
    font-size: 12px;
    line-height: 1.2;
  `,
}));

const LanguageDropdown = memo(() => {
  const { i18n, t } = useTranslation(['common', 'setting']);
  const [language, switchLocale] = useGlobalStore((s) => [
    globalGeneralSelectors.language(s),
    s.switchLocale,
  ]);

  const currentLocale = normalizeLocale(
    i18n.resolvedLanguage || i18n.language || navigator.language,
  );

  const items = useMemo<DropdownMenuCheckboxItem[]>(
    () => [
      {
        checked: language === 'auto',
        closeOnClick: true,
        key: 'auto',
        label: (
          <Flexbox gap={2}>
            <Text className={styles.label}>{t('lang.auto')}</Text>
            <Text className={styles.secondary} type={'secondary'}>
              {t('settingCommon.lang.autoMode', { ns: 'setting' })}
            </Text>
          </Flexbox>
        ),
        onCheckedChange: (checked: boolean) => {
          if (checked) switchLocale('auto');
        },
        type: 'checkbox',
      },
      ...localeOptions.map<DropdownMenuCheckboxItem>((item) => ({
        checked: currentLocale === item.value && language !== 'auto',
        closeOnClick: true,
        key: item.value,
        label: (
          <Flexbox gap={2}>
            <Text className={styles.label}>{item.label}</Text>
            <Text className={styles.secondary} type={'secondary'}>
              {t(`lang.${item.value}` as any, { ns: 'common' })}
            </Text>
          </Flexbox>
        ),
        onCheckedChange: (checked: boolean) => {
          if (checked) switchLocale(item.value);
        },
        type: 'checkbox',
      })),
    ],
    [currentLocale, language, switchLocale, t],
  );

  const currentLabel =
    language === 'auto'
      ? t('settingCommon.lang.autoMode', { ns: 'setting' })
      : (localeOptions.find((item) => item.value === currentLocale)?.label ??
        t(`lang.${currentLocale}` as any));

  return (
    <DropdownMenu items={items} popupProps={{ className: styles.popup }} trigger={['click']}>
      <button aria-label={currentLabel} className={styles.trigger} type="button">
        <Icon icon={GlobeIcon} size={'small'} />
        <Text className={styles.label}>{currentLabel}</Text>
        <Icon icon={ChevronDownIcon} size={'small'} />
      </button>
    </DropdownMenu>
  );
});

LanguageDropdown.displayName = 'LanguageDropdown';

export default LanguageDropdown;
