import { otpService, userService } from '../../services';
import { AuthenticationError } from '@nova/shared';
import { validateTarget, validateOTP } from '../../utils/validate';
import type { Context } from '../../context';

export const requestAddContact = async (
  _: unknown,
  { target, targetType }: { target: string; targetType: 'PHONE' | 'EMAIL' },
  ctx: Context,
) => {
  if (!ctx.userId) throw new AuthenticationError();
  validateTarget(target, targetType);
  await userService.addContact(ctx.userId, target, targetType);
  await otpService.send(target, targetType);
  return { success: true, message: 'OTP sent' };
};

export const verifyAddContact = async (
  _: unknown,
  { target, targetType, otp }: { target: string; targetType: 'PHONE' | 'EMAIL'; otp: string },
  ctx: Context,
) => {
  if (!ctx.userId) throw new AuthenticationError();
  validateTarget(target, targetType);
  validateOTP(otp);
  await otpService.verify(target, targetType, otp);
  await userService.saveContact(ctx.userId, target, targetType);
  return true;
};
