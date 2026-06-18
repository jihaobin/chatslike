'use client';

import { useTranslation } from 'react-i18next';

import { ModelAssignmentsForm } from '@/features/ServiceModel';
import SettingHeader from '@/routes/(main)/settings/features/SettingHeader';
import { featureFlagsSelectors, useServerConfigStore } from '@/store/serverConfig';

import Image from '../image/features/Image';

const Page = () => {
  const { t } = useTranslation('setting');
  const { showAiImage } = useServerConfigStore(featureFlagsSelectors);
  return (
    <>
      <SettingHeader title={t('tab.serviceModel')} />
      <ModelAssignmentsForm />
      {showAiImage && <Image />}
    </>
  );
};

export default Page;
