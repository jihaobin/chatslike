'use client';

import { Block, Icon } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { SettingsIcon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export const HOME_SETTINGS_ICON_ID = 'home-settings-icon';
const SETTINGS_ICON_SIZE = 22;
const SETTINGS_TRIGGER_SIZE = 36;

const styles = createStaticStyles(({ css, cssVar }) => ({
  trigger: css`
    width: ${SETTINGS_TRIGGER_SIZE}px;
    min-width: ${SETTINGS_TRIGGER_SIZE}px;
    height: ${SETTINGS_TRIGGER_SIZE}px;
    margin-block-start: 4px;
    padding: 0;
    color: ${cssVar.colorTextSecondary};
    user-select: none;
    background: ${cssVar.colorFillSecondary};
    border-radius: 50%;
  `,
}));

const SettingsButton = memo(() => {
  const { t } = useTranslation('common');
  const label = t('tab.setting');

  return (
    <Link aria-label={label} title={label} to="/settings">
      <Block
        clickable
        horizontal
        align={'center'}
        className={styles.trigger}
        justify={'center'}
        variant={'borderless'}
      >
        <Icon icon={SettingsIcon} id={HOME_SETTINGS_ICON_ID} size={SETTINGS_ICON_SIZE} />
      </Block>
    </Link>
  );
});

export default SettingsButton;
