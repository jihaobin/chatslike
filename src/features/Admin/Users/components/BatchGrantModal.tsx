'use client';

import { DatePicker, Form, Input, InputNumber, Modal, type ModalProps } from 'antd';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';

import { lambdaQuery } from '@/libs/trpc/client/lambda';

interface Props extends Pick<ModalProps, 'open' | 'onCancel'> {
  onSuccess: () => void;
  userIds: string[];
}

const BatchGrantModal = ({ userIds, open, onCancel, onSuccess }: Props) => {
  const { t } = useTranslation('admin');
  const [form] = Form.useForm();
  const { mutateAsync, isPending } = lambdaQuery.admin.users.batchGrantCredit.useMutation();

  const handleOk = async () => {
    const values = await form.validateFields();
    await mutateAsync({
      amount: Math.round(values.amount * 1_000_000),
      expiresAt: values.expiresAt ? values.expiresAt.toDate() : undefined,
      note: values.note,
      userIds,
    });
    form.resetFields();
    onSuccess();
  };

  return (
    <Modal
      confirmLoading={isPending}
      open={open}
      title={t('users.batchGrant.title', { count: userIds.length })}
      onCancel={onCancel}
      onOk={handleOk}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label={t('users.batchGrant.amountLabel')}
          name="amount"
          rules={[
            { message: t('users.batchGrant.amountRequired'), required: true },
            { min: 0.01, type: 'number' },
          ]}
        >
          <InputNumber min={0.01} step={0.1} style={{ width: '100%' }} suffix="M" />
        </Form.Item>
        <Form.Item label={t('users.batchGrant.expiresLabel')} name="expiresAt">
          <DatePicker
            showTime
            disabledDate={(d) => d.isBefore(dayjs())}
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item label={t('users.batchGrant.noteLabel')} name="note">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default BatchGrantModal;
