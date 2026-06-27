import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { message } from '@/components/AntdStaticMethods';

import enUSAuth from '../../../../../../locales/en-US/auth.json';
import zhCNAuth from '../../../../../../locales/zh-CN/auth.json';
import PhoneVerificationRow from './PhoneVerificationRow';

const sendPhoneVerificationCode = vi.fn();
const verifyPhoneForTrial = vi.fn();
let phoneNumberVerified = false;

vi.mock('@/components/AntdStaticMethods', () => ({
  message: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@/store/user', () => ({
  useUserStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      phone: '',
      phoneNumberVerified,
      sendPhoneVerificationCode,
      verifyPhoneForTrial,
    }),
}));

vi.mock('@/store/user/selectors', () => ({
  userProfileSelectors: {
    phone: (state: { phone: string }) => state.phone,
    phoneNumberVerified: (state: { phoneNumberVerified: boolean }) => state.phoneNumberVerified,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (key === 'profile.phoneCodeSent') return `sent ${params?.phone}`;
      if (key === 'profile.phoneResendCountdown') return `resend ${params?.seconds}`;
      return key;
    },
  }),
}));

describe('PhoneVerificationRow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    phoneNumberVerified = false;
    sendPhoneVerificationCode.mockResolvedValue({
      cooldownSeconds: 60,
      maskedPhone: '+86138****0000',
    });
    verifyPhoneForTrial.mockResolvedValue({
      phone: '+8613800000000',
      phoneNumberVerified: true,
    });
  });

  it('should send code first, then verify phone with code', async () => {
    render(<PhoneVerificationRow />);

    fireEvent.change(screen.getByPlaceholderText('profile.phonePlaceholder'), {
      target: { value: '+8613800000000' },
    });
    fireEvent.click(screen.getByText('profile.phoneSendCodeAction'));

    await waitFor(() => {
      expect(sendPhoneVerificationCode).toHaveBeenCalledWith('+8613800000000');
    });
    expect(screen.getByText('sent +86138****0000')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('profile.phoneCodePlaceholder'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByText('profile.phoneVerifyCodeAction'));

    await waitFor(() => {
      expect(verifyPhoneForTrial).toHaveBeenCalledWith({
        code: '123456',
        phoneNumber: '+8613800000000',
      });
    });
  });

  it('should say phone verification succeeded without trial credit copy', async () => {
    render(<PhoneVerificationRow />);

    fireEvent.change(screen.getByPlaceholderText('profile.phonePlaceholder'), {
      target: { value: '+8613800000000' },
    });
    fireEvent.click(screen.getByText('profile.phoneSendCodeAction'));

    await waitFor(() => {
      expect(sendPhoneVerificationCode).toHaveBeenCalledWith('+8613800000000');
    });

    fireEvent.change(screen.getByPlaceholderText('profile.phoneCodePlaceholder'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByText('profile.phoneVerifyCodeAction'));

    await waitFor(() => {
      expect(message.success).toHaveBeenCalledWith('profile.phoneVerified');
    });
    expect(message.success).not.toHaveBeenCalledWith('profile.phoneTrialGranted');
    expect(message.success).not.toHaveBeenCalledWith('profile.phoneVerifiedTrialAlreadyClaimed');
  });

  it('should include phone verification success copy in runtime locale resources', () => {
    const expectedEnUS = 'Phone verified.';
    const expectedZhCN = '手机已验证。';

    expect(enUSAuth['profile.phoneVerified']).toBe(expectedEnUS);
    expect(zhCNAuth['profile.phoneVerified']).toBe(expectedZhCN);
  });

  it('should not expose trial grant retry for an already verified phone', () => {
    phoneNumberVerified = true;
    render(<PhoneVerificationRow />);

    expect(screen.queryByText('profile.phoneRetryTrialGrantAction')).not.toBeInTheDocument();
  });

  it('should show a clear message when the phone number is already bound', async () => {
    verifyPhoneForTrial.mockRejectedValue(new Error('PHONE_ALREADY_BOUND'));
    render(<PhoneVerificationRow />);

    fireEvent.change(screen.getByPlaceholderText('profile.phonePlaceholder'), {
      target: { value: '+8613800000000' },
    });
    fireEvent.click(screen.getByText('profile.phoneSendCodeAction'));

    await waitFor(() => {
      expect(sendPhoneVerificationCode).toHaveBeenCalledWith('+8613800000000');
    });

    fireEvent.change(screen.getByPlaceholderText('profile.phoneCodePlaceholder'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByText('profile.phoneVerifyCodeAction'));

    await waitFor(() => {
      expect(screen.getByText('profile.phoneAlreadyBound')).toBeInTheDocument();
    });
  });

  it('should show a clear message when verification code has expired', async () => {
    verifyPhoneForTrial.mockRejectedValue(new Error('PHONE_CODE_EXPIRED'));
    render(<PhoneVerificationRow />);

    fireEvent.change(screen.getByPlaceholderText('profile.phonePlaceholder'), {
      target: { value: '+8613800000000' },
    });
    fireEvent.click(screen.getByText('profile.phoneSendCodeAction'));

    await waitFor(() => {
      expect(sendPhoneVerificationCode).toHaveBeenCalledWith('+8613800000000');
    });

    fireEvent.change(screen.getByPlaceholderText('profile.phoneCodePlaceholder'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByText('profile.phoneVerifyCodeAction'));

    await waitFor(() => {
      expect(screen.getByText('profile.phoneCodeExpired')).toBeInTheDocument();
    });
  });

  it('should show a clear message when verification code requests are too frequent', async () => {
    sendPhoneVerificationCode.mockRejectedValue(new Error('PHONE_CODE_SEND_TOO_FREQUENT'));
    render(<PhoneVerificationRow />);

    fireEvent.change(screen.getByPlaceholderText('profile.phonePlaceholder'), {
      target: { value: '+8613800000000' },
    });
    fireEvent.click(screen.getByText('profile.phoneSendCodeAction'));

    await waitFor(() => {
      expect(screen.getByText('profile.phoneCodeSendTooFrequent')).toBeInTheDocument();
    });
  });
});
