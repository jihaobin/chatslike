import type { SearchQuery, UniformSearchResponse } from '@lobechat/types';
import { Flexbox, Skeleton } from '@lobehub/ui';
import { memo } from 'react';

import { useChatStore } from '@/store/chat';
import { chatToolSelectors } from '@/store/chat/selectors';

import ResultList from './ResultList';

interface InspectorUIProps {
  messageId: string;
  query: SearchQuery;
  response: UniformSearchResponse;
}

const Inspector = memo<InspectorUIProps>(({ messageId, response }) => {
  const loading = useChatStore(chatToolSelectors.isSearXNGSearching(messageId));

  if (loading) {
    return (
      <Flexbox gap={12} height={'100%'}>
        <Flexbox gap={16} paddingBlock={16} paddingInline={12}>
          {[1, 2, 3, 4, 6].map((id) => (
            <Skeleton
              active
              key={id}
              paragraph={{ rows: 3, width: `${(id % 4) + 5}0%` }}
              title={false}
            />
          ))}
        </Flexbox>
      </Flexbox>
    );
  }

  return (
    <Flexbox height={'100%'} width={'100%'}>
      <ResultList dataSources={response.results} />
    </Flexbox>
  );
});

export default Inspector;
