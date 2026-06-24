'use client';

import { DatePicker, Form, InputNumber, Modal, type ModalProps } from 'antd';
import dayjs from 'dayjs';

import { lambdaQuery } from '@/libs/trpc/client/lambda';

interface Props extends Pick<ModalProps, 'open' | 'onCancel'> {
  onSuccess: () => void;
  userId: string;
}

const GrantCreditModal = ({ userId, open, onCancel, onSuccess }: Props) => {
  const [form] = Form.useForm();
  const { mutateAsync, isPending } = lambdaQuery.admin.users.grantCredit.useMutation();

  const handleOk = async () => {
    const values = await form.validateFields();
    await mutateAsync({
      amount: Math.round(values.amount * 1_000_000),
      expiresAt: values.expiresAt ? values.expiresAt.toDate() : undefined,
      userId,
    });
    form.resetFields();
    onSuccess();
  };

  return (
    <Modal
      confirmLoading={isPending}
      open={open}
      title="发放积分"
      onCancel={onCancel}
      onOk={handleOk}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="积分数量（M，百万）"
          name="amount"
          rules={[
            { message: '请输入积分数量', required: true },
            { min: 0.01, type: 'number' },
          ]}
        >
          <InputNumber min={0.01} step={0.1} style={{ width: '100%' }} suffix="M" />
        </Form.Item>
        <Form.Item label="有效期（可选）" name="expiresAt">
          <DatePicker
            showTime
            disabledDate={(d) => d.isBefore(dayjs())}
            style={{ width: '100%' }}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default GrantCreditModal;
