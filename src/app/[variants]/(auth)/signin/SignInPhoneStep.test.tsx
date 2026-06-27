import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SignInPhoneStep } from './SignInPhoneStep';

const mockPush = vi.hoisted(() => vi.fn());
const mockSearchParamsGet = vi.hoisted(() => vi.fn().mockReturnValue('/chat'));
const mockMessageError = vi.hoisted(() => vi.fn());
const mockMessageSuccess = vi.hoisted(() => vi.fn());
const mockSendOtp = vi.hoisted(() => vi.fn());
const mockVerify = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: mockSearchParamsGet }),
}));

vi.mock('react-i18next', () => ({
  Trans: ({ i18nKey }: { i18nKey: string }) => <>{i18nKey}</>,
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      key === 'betterAuth.signin.phoneStep.sendCodeCountdown'
        ? `Resend in ${options?.seconds}s`
        : key,
  }),
}));

vi.mock('@/components/AntdStaticMethods', () => ({
  message: { error: mockMessageError, success: mockMessageSuccess },
}));

vi.mock('@/libs/better-auth/auth-client', () => ({
  phoneNumber: {
    sendOtp: mockSendOtp,
    verify: mockVerify,
  },
}));

describe('SignInPhoneStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParamsGet.mockReturnValue('/chat');
  });

  it('sends OTP only after validating the phone number', async () => {
    mockSendOtp.mockResolvedValueOnce({ error: null });
    render(<SignInPhoneStep />);

    fireEvent.click(screen.getByRole('button', { name: 'betterAuth.signin.phoneStep.sendCode' }));

    expect(mockSendOtp).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText('betterAuth.signin.phoneStep.phonePlaceholder'), {
      target: { value: '13800138000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'betterAuth.signin.phoneStep.sendCode' }));

    await waitFor(() => {
      expect(mockSendOtp).toHaveBeenCalledWith({ phoneNumber: '13800138000' });
    });
    expect(mockMessageSuccess).toHaveBeenCalledWith('profile.phoneCodeSent');
    expect(screen.getByRole('button', { name: 'Resend in 60s' })).toBeInTheDocument();
  });

  it('does not start the countdown when sending OTP returns an error', async () => {
    mockSendOtp.mockResolvedValueOnce({ error: { message: 'SMS unavailable' } });
    render(<SignInPhoneStep />);

    fireEvent.change(screen.getByPlaceholderText('betterAuth.signin.phoneStep.phonePlaceholder'), {
      target: { value: '13800138000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'betterAuth.signin.phoneStep.sendCode' }));

    await waitFor(() => {
      expect(mockSendOtp).toHaveBeenCalledWith({ phoneNumber: '13800138000' });
    });
    expect(mockMessageError).toHaveBeenCalledWith('SMS unavailable');
    expect(
      screen.getByRole('button', { name: 'betterAuth.signin.phoneStep.sendCode' }),
    ).toBeInTheDocument();
  });

  it('verifies the code and redirects to callbackUrl', async () => {
    mockVerify.mockResolvedValueOnce({ error: null });
    render(<SignInPhoneStep />);

    fireEvent.change(screen.getByPlaceholderText('betterAuth.signin.phoneStep.phonePlaceholder'), {
      target: { value: '13800138000' },
    });
    fireEvent.change(screen.getByPlaceholderText('betterAuth.signin.phoneStep.codePlaceholder'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'betterAuth.signin.phoneStep.submit' }));

    await waitFor(() => {
      expect(mockVerify).toHaveBeenCalledWith({
        code: '123456',
        phoneNumber: '13800138000',
      });
    });
    expect(mockPush).toHaveBeenCalledWith('/chat');
  });
});
