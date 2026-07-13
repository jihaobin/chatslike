import { Button, Center, Icon } from '@lobehub/ui';
import { createStaticStyles, cx } from 'antd-style';
import type { LucideIcon } from 'lucide-react';
import { ImageIcon, VideoIcon } from 'lucide-react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useStableNavigate } from '@/hooks/useStableNavigate';

type StarterKey = 'image' | 'video';

const styles = createStaticStyles(({ css, cssVar }) => ({
  button: css`
    height: 38px;
    padding-inline: 16px !important;
    border-color: ${cssVar.colorFillSecondary};
    background: transparent;
    box-shadow: none !important;

    &:hover {
      border-color: ${cssVar.colorFillSecondary} !important;
      background: ${cssVar.colorBgElevated} !important;
    }
  `,
}));

type StarterTitleKey = 'starter.generateImage' | 'starter.generateVideo';

interface StarterItem {
  icon: LucideIcon;
  key: StarterKey;
  path: string;
  titleKey: StarterTitleKey;
}

const starterItems: StarterItem[] = [
  {
    icon: ImageIcon,
    key: 'image',
    path: '/home/image?model=gpt-image-2',
    titleKey: 'starter.generateImage',
  },
  {
    icon: VideoIcon,
    key: 'video',
    path: '/home/video?model=dreamina-seedance-2-0-260128',
    titleKey: 'starter.generateVideo',
  },
];

const StarterList = memo(() => {
  const { t } = useTranslation('home');
  const navigate = useStableNavigate();

  const handleClick = useCallback(
    (path: string) => {
      navigate(path);
    },
    [navigate],
  );

  return (
    <Center horizontal gap={8}>
      {starterItems.map((item) => (
        <Button
          className={cx(styles.button)}
          icon={<Icon icon={item.icon} size={16} />}
          key={item.key}
          shape={'round'}
          variant={'outlined'}
          onClick={() => handleClick(item.path)}
        >
          {t(item.titleKey)}
        </Button>
      ))}
    </Center>
  );
});

export default StarterList;
