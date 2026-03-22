import { otpService } from '../../services';

export const resendOTP = async (
  _: unknown,
  { target, targetType }: { target: string; targetType: 'PHONE' | 'EMAIL' },
) => {
  await otpService.resend(target, targetType);
  return { success: true, message: 'OTP resent' };
};
