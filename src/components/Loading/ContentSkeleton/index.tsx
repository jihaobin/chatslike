'use client';

import { Flexbox, Skeleton } from '@lobehub/ui';
import { memo } from 'react';

const ContentSkeleton = memo(() => (
  <Flexbox flex={1} gap={16} padding={24}>
    <Skeleton active title paragraph={{ rows: 1 }} style={{ width: 240 }} />
    <Skeleton active paragraph={{ rows: 6 }} title={false} />
    <Skeleton active paragraph={{ rows: 4 }} title={false} />
  </Flexbox>
));

ContentSkeleton.displayName = 'ContentSkeleton';

export default ContentSkeleton;
