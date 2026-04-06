import { otpService } from '../../services';
import { validateTarget } from '../../utils/validate';

export const resendOTP = async (
  _: unknown,
  { target, targetType }: { target: string; targetType: 'PHONE' | 'EMAIL' },
) => {
  validateTarget(target, targetType);
  await otpService.resend(target, targetType);
  return { success: true, message: 'OTP resent' };
};
