'use client';

import { Center, Flexbox } from '@lobehub/ui/es/Flex/index';
import Icon from '@lobehub/ui/es/Icon/index';
import Text from '@lobehub/ui/es/Text/index';
import { LoaderCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const CircleLoading = () => {
  const { t } = useTranslation('common');
  return (
    <Center height={'100%'} width={'100%'}>
      <Flexbox align={'center'} gap={8}>
        <div>
          <Icon spin icon={LoaderCircle} size={'large'} />
        </div>
        <Text style={{ letterSpacing: '0.1em' }} type={'secondary'}>
          {t('loading')}
        </Text>
      </Flexbox>
    </Center>
  );
};

export default CircleLoading;
