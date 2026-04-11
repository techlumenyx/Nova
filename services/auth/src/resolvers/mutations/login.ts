import { otpService, userService } from '../../services';
import { NotFoundError } from '@nova/shared';
import { validateTarget } from '../../utils/validate';
import { checkRateLimit } from '../../utils/rateLimiter';
import type { Context } from '../../context';

export const login = async (
  _: unknown,
  { target, targetType }: { target: string; targetType: 'PHONE' | 'EMAIL' },
  ctx: Context,
) => {
  // await checkRateLimit('login', ctx.ip);
  // validateTarget(target, targetType);

  const user = await userService.findByTarget(target, targetType);
  if (!user) throw new NotFoundError('User');

  await otpService.send(target, targetType);
  return { success: true, message: 'OTP sent' };
};
