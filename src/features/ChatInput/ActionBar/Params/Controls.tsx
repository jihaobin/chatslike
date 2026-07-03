import { Flexbox, SliderWithInput, TextArea } from '@lobehub/ui';
import { Form as AntdForm, Switch } from 'antd';
import { createStaticStyles, cssVar, cx } from 'antd-style';
import { debounce } from 'es-toolkit/compat';
import isEqual from 'fast-deep-equal';
import type { ReactNode } from 'react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PartialDeep } from 'type-fest';

import InfoTooltip from '@/components/InfoTooltip';
import NeuralNetworkLoading from '@/components/NeuralNetworkLoading';
import { useAgentStore } from '@/store/agent';
import { agentByIdSelectors, chatConfigByIdSelectors } from '@/store/agent/selectors';
import { useUserStore } from '@/store/user';
import { systemAgentSelectors } from '@/store/user/selectors';
import type { LobeAgentConfig } from '@/types/agent';

import { useAgentId } from '../../hooks/useAgentId';
import { useUpdateAgentConfig } from '../../hooks/useUpdateAgentConfig';

interface ControlsProps {
  setUpdating: (updating: boolean) => void;
  updating: boolean;
  variant?: 'popover' | 'sidebar';
}

const styles = createStaticStyles(({ css }) => ({
  body: css`
    overflow-y: auto;
    overscroll-behavior: contain;
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;

    min-height: 0;
    padding-block-end: 4px;
    padding-inline: 12px;
  `,
  commonSection: css`
    display: flex;
    flex-direction: column;
    padding-block: 0;
  `,
  hint: css`
    font-size: 12px;
    line-height: 18px;
    color: ${cssVar.colorTextTertiary};
  `,
  form: css`
    margin: 0;
  `,
  header: css`
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;

    padding-block: 16px;
    padding-inline: 12px;
    border-block-end: 1px solid ${cssVar.colorSplit};

    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: ${cssVar.colorText};
  `,
  headerLoading: css`
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;

    width: 18px;
    height: 18px;

    color: ${cssVar.colorTextTertiary};
  `,
  headerTitle: css`
    overflow: hidden;
    min-width: 0;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  label: css`
    user-select: none;

    min-width: 0;

    font-size: 13px;
    font-weight: 500;
    line-height: 20px;
    color: ${cssVar.colorTextSecondary};
  `,
  labelMain: css`
    flex-wrap: wrap;
    min-width: 0;
  `,
  muted: css`
    .control-label {
      color: ${cssVar.colorTextTertiary};
    }
  `,
  panel: css`
    overflow: hidden;
    display: flex;
    flex-direction: column;

    width: min(384px, 100%);
    max-height: 50vh;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 16px;

    background: ${cssVar.colorBgElevated};
    box-shadow: ${cssVar.boxShadowSecondary};

    .ant-switch {
      min-width: 28px;
      background: ${cssVar.colorFillSecondary};
    }

    .ant-switch .ant-switch-handle::before {
      background: ${cssVar.colorBgElevated};
    }

    .ant-switch.ant-switch-checked {
      background: ${cssVar.colorText};
    }

    .ant-form-item {
      margin: 0;
    }
  `,
  sidebarPanel: css`
    width: 100%;
    height: 100%;
    max-height: none;
    border: none;
    border-radius: 0;

    background: transparent;
    box-shadow: none;
  `,
  rowControl: css`
    width: 100%;
  `,
  rowRoot: css`
    padding-block: 12px;
  `,
  tag: css`
    user-select: none;

    align-self: flex-start;

    width: fit-content;
    padding-block: 2px;
    padding-inline: 7px;
    border-radius: 999px;

    font-family: ${cssVar.fontFamilyCode};
    font-size: 10px;
    font-weight: 500;
    line-height: 1.2;
    color: ${cssVar.colorTextQuaternary};

    background: ${cssVar.colorFillQuaternary};
  `,
  tooltipContent: css`
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-width: 240px;
  `,
  slider: css`
    width: 100%;

    .ant-slider {
      margin-block: 0;
      margin-inline: 0;
    }

    .ant-slider-rail {
      background: ${cssVar.colorFillQuaternary};
    }

    .ant-slider-track {
      background: ${cssVar.colorTextSecondary};
    }

    .ant-slider-handle::after {
      background: ${cssVar.colorBgElevated};
      box-shadow: 0 0 0 2px ${cssVar.colorTextSecondary};
    }

    .ant-slider-handle:hover::after,
    .ant-slider-handle:focus::after,
    .ant-slider-handle:active::after {
      box-shadow: 0 0 0 3px ${cssVar.colorTextSecondary};
    }

    .ant-input-number,
    .ant-input-number-affix-wrapper {
      overflow: hidden;

      height: 28px;
      border: none;
      border-radius: 10px;

      color: ${cssVar.colorTextSecondary};

      background: ${cssVar.colorFillTertiary};
      box-shadow: none;
    }

    .ant-input-number:hover,
    .ant-input-number-focused,
    .ant-input-number-affix-wrapper:hover,
    .ant-input-number-affix-wrapper-focused {
      background: ${cssVar.colorFillSecondary};
      box-shadow: none;
    }

    .ant-input-number-input {
      height: 28px;
      padding-inline: 6px;

      font-size: 13px;
      color: ${cssVar.colorTextSecondary};
      text-align: center;
    }
  `,
}));

interface ControlLabelProps {
  tag?: string;
  title: string;
  tooltip?: string;
}

const ControlLabel = memo<ControlLabelProps>(({ title, tooltip, tag }) => (
  <Flexbox align={'flex-start'} className={cx(styles.label, 'control-label')} gap={6}>
    <Flexbox horizontal align={'center'} className={styles.labelMain} gap={6}>
      {title}
      {tooltip && (
        <InfoTooltip
          title={
            <div className={styles.tooltipContent}>
              {tag && <span className={styles.tag}>{tag}</span>}
              <span>{tooltip}</span>
            </div>
          }
        />
      )}
    </Flexbox>
  </Flexbox>
));

interface ControlRowProps {
  action?: ReactNode;
  children?: ReactNode;
  muted?: boolean;
  tag?: string;
  title: string;
  tooltip?: string;
}

const ControlRow = memo<ControlRowProps>(({ action, children, muted, tag, title, tooltip }) => (
  <Flexbox className={cx('control-row', styles.rowRoot, muted && styles.muted)} gap={10}>
    <Flexbox horizontal align={'center'} gap={12} justify={'space-between'}>
      <ControlLabel tag={tag} title={title} tooltip={tooltip} />
      {action}
    </Flexbox>
    {children && <div className={styles.rowControl}>{children}</div>}
  </Flexbox>
));

interface SliderConfig {
  max: number;
  min: number;
  step: number;
  unlimitedInput?: boolean;
}

interface SliderFieldProps extends SliderConfig {
  inputWidth?: number;
  onChange: (value: number) => void;
  value?: number;
}

const SliderField = memo<SliderFieldProps>(
  ({ value, onChange, min, max, step, unlimitedInput, inputWidth = 56 }) => (
    <SliderWithInput
      changeOnWheel
      className={styles.slider}
      controls={false}
      gap={10}
      max={max}
      min={min}
      size={'small'}
      step={step}
      style={{ height: 28 }}
      unlimitedInput={unlimitedInput}
      value={value}
      styles={{
        input: {
          maxWidth: inputWidth,
        },
      }}
      onChange={onChange}
    />
  ),
);

const Controls = memo<ControlsProps>(({ setUpdating, updating, variant = 'popover' }) => {
  const { t } = useTranslation(['setting', 'components']);
  const agentId = useAgentId();
  const { updateAgentConfig } = useUpdateAgentConfig();

  const config = useAgentStore(
    (s) => agentByIdSelectors.getAgentConfigById(agentId)(s) ?? {},
    isEqual,
  );
  const enableAgentMode = useAgentStore(agentByIdSelectors.getAgentEnableModeById(agentId));
  const [form] = AntdForm.useForm();
  const [, refreshFormValues] = useState(0);

  const enableContextCompression = form.getFieldValue(['chatConfig', 'enableContextCompression']);
  const enableHistoryCount = form.getFieldValue(['chatConfig', 'enableHistoryCount']);
  const historyCountValue = form.getFieldValue(['chatConfig', 'historyCount']);
  const inputTemplateValue = form.getFieldValue(['chatConfig', 'inputTemplate']);
  const enableAutoScrollOnStreaming = form.getFieldValue([
    'chatConfig',
    'enableAutoScrollOnStreaming',
  ]);
  const enableStreaming = form.getFieldValue(['chatConfig', 'enableStreaming']);
  const enableFollowUpChips = form.getFieldValue(['chatConfig', 'enableFollowUpChips']);
  const globalFollowUp = useUserStore(systemAgentSelectors.followUpAction, isEqual);
  const globalFollowUpReady =
    globalFollowUp.enabled === true && !!globalFollowUp.model && !!globalFollowUp.provider;
  const showFollowUpHint = !globalFollowUpReady && Boolean(enableFollowUpChips);

  const historyCountFromStore = useAgentStore((s) =>
    chatConfigByIdSelectors.getHistoryCountById(agentId)(s),
  );
  // Use raw chatConfig value, not the selector with business logic that may force false
  const enableHistoryCountFromStore = useAgentStore(
    (s) => chatConfigByIdSelectors.getChatConfigById(agentId)(s).enableHistoryCount,
  );

  useEffect(() => {
    form.setFieldsValue(config);
    refreshFormValues((value) => value + 1);
  }, [config, form]);

  // Sync history count values to form
  useEffect(() => {
    // Skip syncing when updating to avoid overwriting user's in-progress edits
    if (updating) return;

    form.setFieldsValue({
      chatConfig: {
        ...form.getFieldValue('chatConfig'),
        enableHistoryCount: enableHistoryCountFromStore,
        historyCount: historyCountFromStore,
      },
    });
    refreshFormValues((value) => value + 1);
  }, [form, enableHistoryCountFromStore, historyCountFromStore, updating]);

  const panelTitle = enableAgentMode
    ? t('settingModel.params.panel.agentTitle')
    : t('settingModel.params.panel.title');

  const handleValuesChange = useMemo(
    () =>
      debounce(async (values: PartialDeep<LobeAgentConfig>) => {
        setUpdating(true);
        try {
          await updateAgentConfig(values);
        } finally {
          setUpdating(false);
        }
      }, 500),
    [updateAgentConfig, setUpdating],
  );

  const handleFieldChange = useCallback(
    (namePath: (string | number)[], value: boolean | number | string) => {
      form.setFieldValue(namePath, value);
      refreshFormValues((current) => current + 1);
      handleValuesChange(form.getFieldsValue(true) as PartialDeep<LobeAgentConfig>);
    },
    [form, handleValuesChange, refreshFormValues],
  );

  return (
    <div className={styles.form}>
      <div className={cx(styles.panel, variant === 'sidebar' && styles.sidebarPanel)}>
        <div className={styles.header}>
          <span className={styles.headerTitle}>{panelTitle}</span>
          {updating && (
            <div className={styles.headerLoading}>
              <NeuralNetworkLoading size={18} />
            </div>
          )}
        </div>
        <div className={styles.body}>
          <div className={styles.commonSection}>
            <ControlRow
              tag="compression"
              title={t('settingModel.params.panel.contextCompression')}
              tooltip={t('settingModel.enableContextCompression.desc')}
              action={
                <Switch
                  checked={Boolean(enableContextCompression)}
                  size={'small'}
                  onChange={(checked) => {
                    handleFieldChange(['chatConfig', 'enableContextCompression'], checked);
                  }}
                />
              }
            />
            <ControlRow
              tag="history"
              title={t('settingModel.params.panel.historyLimit')}
              tooltip={t('settingChat.historyCount.desc')}
              action={
                <Switch
                  checked={Boolean(enableHistoryCount)}
                  size={'small'}
                  onChange={(checked) => {
                    handleFieldChange(['chatConfig', 'enableHistoryCount'], checked);
                  }}
                />
              }
            >
              {enableHistoryCount && (
                <SliderField
                  unlimitedInput
                  inputWidth={56}
                  max={20}
                  min={0}
                  step={1}
                  value={typeof historyCountValue === 'number' ? historyCountValue : 0}
                  onChange={(value) => {
                    handleFieldChange(['chatConfig', 'historyCount'], value);
                  }}
                />
              )}
            </ControlRow>
            <ControlRow
              tag="autoScroll"
              title={t('settingChat.enableAutoScrollOnStreaming.title')}
              tooltip={t('settingChat.enableAutoScrollOnStreaming.desc')}
              action={
                <Switch
                  checked={Boolean(enableAutoScrollOnStreaming)}
                  size={'small'}
                  onChange={(checked) => {
                    handleFieldChange(['chatConfig', 'enableAutoScrollOnStreaming'], checked);
                  }}
                />
              }
            />
            <ControlRow
              tag="streaming"
              title={t('settingChat.enableStreaming.title')}
              tooltip={t('settingChat.enableStreaming.desc')}
              action={
                <Switch
                  checked={enableStreaming !== false}
                  size={'small'}
                  onChange={(checked) => {
                    handleFieldChange(['chatConfig', 'enableStreaming'], checked);
                  }}
                />
              }
            />
            <ControlRow
              tag="followUpChips"
              title={t('settingChat.enableFollowUpChips.title')}
              tooltip={t('settingChat.enableFollowUpChips.desc')}
              action={
                <Switch
                  checked={Boolean(enableFollowUpChips)}
                  size={'small'}
                  onChange={(checked) => {
                    handleFieldChange(['chatConfig', 'enableFollowUpChips'], checked);
                  }}
                />
              }
            >
              {showFollowUpHint && (
                <div className={styles.hint}>
                  {t('settingChat.enableFollowUpChips.notConfiguredHint')}
                </div>
              )}
            </ControlRow>
            <ControlRow
              tag="inputTemplate"
              title={t('settingChat.inputTemplate.title')}
              tooltip={t('settingChat.inputTemplate.desc')}
            >
              <TextArea
                placeholder={t('settingChat.inputTemplate.placeholder')}
                value={typeof inputTemplateValue === 'string' ? inputTemplateValue : ''}
                onChange={(e) => {
                  handleFieldChange(['chatConfig', 'inputTemplate'], e.target.value);
                }}
              />
            </ControlRow>
          </div>
        </div>
      </div>
    </div>
  );
});

export default Controls;
