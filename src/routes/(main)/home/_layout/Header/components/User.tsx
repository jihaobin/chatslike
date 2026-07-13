'use client';

import { Block, Icon } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { CircleUserRoundIcon } from 'lucide-react';
import { memo } from 'react';

import UserPanel from '@/features/User/UserPanel';

export const USER_DROPDOWN_ICON_ID = 'user-dropdown-icon';
const USER_TRIGGER_ICON_SIZE = 22;
const USER_TRIGGER_SIZE = 36;

// The dropdown is a button surface, not selectable text. Without
// `user-select: none` a triple-click (or click-drag through the avatar /
// name) paints the system text-selection highlight across the whole row;
// that bright blue is heavier than the Sidebar's active-route fill below
// and inverts the visual hierarchy.
const styles = createStaticStyles(({ css, cssVar }) => ({
  trigger: css`
    width: ${USER_TRIGGER_SIZE}px;
    min-width: ${USER_TRIGGER_SIZE}px;
    height: ${USER_TRIGGER_SIZE}px;
    margin-block-start: 4px;
    margin-inline-end: 8px;
    padding: 0;
    color: ${cssVar.colorTextSecondary};
    user-select: none;
    background: ${cssVar.colorFillSecondary};
    border-radius: 50%;
  `,
}));

const User = memo(() => {
  return (
    <UserPanel>
      <Block
        clickable
        horizontal
        align={'center'}
        className={styles.trigger}
        justify={'center'}
        variant={'borderless'}
      >
        <Icon icon={CircleUserRoundIcon} id={USER_DROPDOWN_ICON_ID} size={USER_TRIGGER_ICON_SIZE} />
      </Block>
    </UserPanel>
  );
});

export default User;
