'use client';

import { SiDiscord, SiGithub, SiMedium, SiX } from '@icons-pack/react-simple-icons';
import { SOCIAL_URL } from '@lobechat/business-const';
import { ActionIcon, Flexbox } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

const styles = createStaticStyles(({ css }) => {
  return {
    icon: css`
      svg {
        fill: ${cssVar.colorTextDescription};
      }

      &:hover {
        svg {
          fill: ${cssVar.colorText};
        }
      }
    `,
  };
});

const Follow = memo(() => {
  const { t } = useTranslation('common');

  const links = [
    { icon: SiGithub, name: 'GitHub', url: SOCIAL_URL.github },
    { icon: SiX, name: 'X', url: SOCIAL_URL.x },
    { icon: SiDiscord, name: 'Discord', url: SOCIAL_URL.discord },
    { icon: SiMedium, name: 'Medium', url: SOCIAL_URL.medium },
  ].filter(({ url }) => Boolean(url));

  if (links.length === 0) return null;

  return (
    <Flexbox horizontal gap={8}>
      {links.map(({ icon, name, url }) => (
        <a href={url} key={name} rel="noreferrer" target="_blank">
          <ActionIcon className={styles.icon} icon={icon as any} title={t('follow', { name })} />
        </a>
      ))}
    </Flexbox>
  );
});

Follow.displayName = 'Follow';

export default Follow;
