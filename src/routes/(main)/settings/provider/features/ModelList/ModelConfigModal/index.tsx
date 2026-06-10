import { Button, Modal } from '@lobehub/ui';
import { type FormInstance } from 'antd';
import isEqual from 'fast-deep-equal';
import { type AiProviderModelListItem } from 'model-bank';
import { memo, use, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { aiModelSelectors, useAiInfraStore } from '@/store/aiInfra';

import ProviderPricing from '../../ProviderPricing';
import ModelConfigForm from '../CreateNewModelModal/Form';
import { ProviderSettingsContext } from '../ProviderSettingsContext';

interface ModelConfigModalProps {
  id: string;
  model?: AiProviderModelListItem;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const ModelConfigModal = memo<ModelConfigModalProps>(
  ({ id, model: modelFromItem, open, setOpen }) => {
    const { t } = useTranslation(['common', 'setting']);
    const [formInstance, setFormInstance] = useState<FormInstance>();
    const [loading, setLoading] = useState(false);
    const [editingProvider, updateAiModelsConfig] = useAiInfraStore((s) => [
      s.activeAiProvider!,
      s.updateAiModelsConfig,
    ]);
    const activeProviderConfigScope = useAiInfraStore((s) => s.activeProviderConfigScope);
    const modelFromStore = useAiInfraStore(aiModelSelectors.getAiModelById(id), isEqual);
    const model = modelFromItem || modelFromStore;

    const closeModal = () => {
      setOpen(false);
    };
    const { showDeployName } = use(ProviderSettingsContext);

    return (
      <Modal
        destroyOnHidden
        maskClosable
        open={open}
        title={t('llm.customModelCards.modelConfig.modalTitle', { ns: 'setting' })}
        zIndex={1251} // Select is 1150
        footer={[
          <Button key="cancel" onClick={closeModal}>
            {t('cancel')}
          </Button>,
          <Button
            key="ok"
            loading={loading}
            style={{ marginInlineStart: '16px' }}
            type="primary"
            onClick={async () => {
              if (!editingProvider || !id || !formInstance) return;
              const data = formInstance.getFieldsValue();

              setLoading(true);
              await updateAiModelsConfig(id, editingProvider, data);
              setLoading(false);

              closeModal();
            }}
          >
            {t('ok')}
          </Button>,
        ]}
        styles={{
          body: {
            display: 'flex',
            flexDirection: 'column',
            maxHeight: 'calc(100vh - 150px)',
          },
        }}
        onCancel={closeModal}
      >
        <ModelConfigForm
          idEditable={false}
          initialValues={model}
          showDeployName={showDeployName}
          type={model?.type}
          onFormInstanceReady={setFormInstance}
        />
        {editingProvider && (
          <ProviderPricing
            model={id}
            modelType={model?.type}
            provider={editingProvider}
            readonly={activeProviderConfigScope !== 'global'}
            scope={activeProviderConfigScope}
            upstreamPricing={model?.pricing}
          />
        )}
      </Modal>
    );
  },
);
export default ModelConfigModal;
