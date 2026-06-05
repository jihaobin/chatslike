import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { message } from '@/components/AntdStaticMethods';

import PhoneVerificationRow from './PhoneVerificationRow';

const sendPhoneVerificationCode = vi.fn();
const verifyPhoneForTrial = vi.fn();

vi.mock('@/components/AntdStaticMethods', () => ({
  message: { success: vi.fn() },
}));

vi.mock('@/store/user', () => ({
  useUserStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      phone: '',
      phoneNumberVerified: false,
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
    sendPhoneVerificationCode.mockResolvedValue({
      cooldownSeconds: 60,
      maskedPhone: '+86138****0000',
    });
    verifyPhoneForTrial.mockResolvedValue({ trial: { granted: true } });
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

  it('should not say trial credits were issued when the grant was already claimed', async () => {
    verifyPhoneForTrial.mockResolvedValue({ trial: { granted: false } });
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
      expect(message.success).toHaveBeenCalledWith('profile.phoneVerifiedTrialAlreadyClaimed');
    });
    expect(message.success).not.toHaveBeenCalledWith('profile.phoneTrialGranted');
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
