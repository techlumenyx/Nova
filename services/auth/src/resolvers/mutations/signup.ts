import { otpService, userService } from '../../services';
import { ValidationError } from '@nova/shared';
import { validateTarget } from '../../utils/validate';
import { checkRateLimit } from '../../utils/rateLimiter';
import type { Context } from '../../context';

export const signup = async (
  _: unknown,
  { input }: { input: { name: string; target: string; targetType: 'PHONE' | 'EMAIL'; language?: 'EN' | 'HI' | 'HINGLISH' } },
  ctx: Context,
) => {
  await checkRateLimit('signup', ctx.ip);
  validateTarget(input.target, input.targetType);

  const existing = await userService.findByTarget(input.target, input.targetType);
  if (existing) throw new ValidationError('Account already exists. Please login.');

  await otpService.sendSignup(input.target, input.targetType, input.name, input.language);
  return { success: true, message: 'OTP sent' };
};
