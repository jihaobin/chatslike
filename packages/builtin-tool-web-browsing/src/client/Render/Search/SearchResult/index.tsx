import { WebBrowsingManifest } from '@lobechat/builtin-tool-web-browsing';
import type { SearchQuery, UniformSearchResponse } from '@lobechat/types';
import { Block, Button, Empty, Flexbox, Icon, Skeleton } from '@lobehub/ui';
import { Edit2Icon, SearchIcon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { useIsMobile } from '@/hooks/useIsMobile';
import { useChatStore } from '@/store/chat';
import { chatToolSelectors } from '@/store/chat/selectors';

import { WebBrowsingEvent, WebBrowsingLinkList } from '../../../components';

const ITEM_HEIGHT = 80;
const ITEM_WIDTH = 160;

interface SearchResultProps {
  args: SearchQuery;
  editing: boolean;
  messageId: string;
  pluginState?: UniformSearchResponse;
  setEditing: (editing: boolean) => void;
}

const SearchResult = memo<SearchResultProps>(({ messageId, pluginState, setEditing, editing }) => {
  const loading = useChatStore(chatToolSelectors.isSearXNGSearching(messageId));
  const searchResults = pluginState?.results || [];
  const { t } = useTranslation(['tool', 'common', 'plugin']);

  const isMobile = useIsMobile();
  const openToolUI = useChatStore((s) => s.openToolUI);

  if (loading || !pluginState)
    return (
      <Flexbox horizontal gap={8}>
        {['1', '2', '3', '4', '5'].map((id) => (
          <Skeleton.Block active height={ITEM_HEIGHT} key={id} width={ITEM_WIDTH} />
        ))}
      </Flexbox>
    );

  if (searchResults.length === 0)
    return (
      <Block variant={'outlined'}>
        <Empty description={t('search.emptyResult')} icon={SearchIcon}>
          {!editing && (
            <Button
              color={'default'}
              icon={<Icon icon={Edit2Icon} />}
              size={'small'}
              variant={'filled'}
              onClick={() => {
                setEditing(true);
              }}
            >
              {t('edit', { ns: 'common' })}
            </Button>
          )}
        </Empty>
      </Block>
    );

  const visibleResults = searchResults.slice(0, 3);
  const sources = searchResults.flatMap((result) => result.engines || []);

  return (
    <WebBrowsingEvent
      iconLabel={<Icon icon={SearchIcon} size={12} />}
      showMoreLabel={t('search.browsing.showAll', { ns: 'plugin' })}
      sources={sources}
      title={t('search.browsing.webResults', { count: searchResults.length, ns: 'plugin' })}
      onShowMore={
        !isMobile && searchResults.length > visibleResults.length
          ? () => openToolUI(messageId, WebBrowsingManifest.identifier)
          : undefined
      }
    >
      <WebBrowsingLinkList
        items={visibleResults.map((result) => ({
          title: result.title,
          url: result.url,
        }))}
      />
    </WebBrowsingEvent>
  );
});

export default SearchResult;
