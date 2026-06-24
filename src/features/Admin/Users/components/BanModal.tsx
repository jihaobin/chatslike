'use client';

import { DatePicker, Form, Input, Modal, type ModalProps } from 'antd';
import dayjs from 'dayjs';

import { lambdaQuery } from '@/libs/trpc/client/lambda';

interface Props extends Pick<ModalProps, 'open' | 'onCancel'> {
  onSuccess: () => void;
  userId: string;
}

const BanModal = ({ userId, open, onCancel, onSuccess }: Props) => {
  const [form] = Form.useForm();
  const { mutateAsync, isPending } = lambdaQuery.admin.users.banUser.useMutation();

  const handleOk = async () => {
    const values = await form.validateFields();
    await mutateAsync({
      banExpires: values.banExpires ? values.banExpires.toDate() : undefined,
      banReason: values.banReason,
      userId,
    });
    form.resetFields();
    onSuccess();
  };

  return (
    <Modal
      confirmLoading={isPending}
      okButtonProps={{ danger: true }}
      okText="确认封禁"
      open={open}
      title="封禁用户"
      onCancel={onCancel}
      onOk={handleOk}
    >
      <Form form={form} layout="vertical">
        <Form.Item label="封禁原因" name="banReason">
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item label="到期时间（留空为永久）" name="banExpires">
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

export default BanModal;
