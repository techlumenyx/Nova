import { otpService, userService } from '../../services';
import { NotFoundError } from '@nova/shared';

export const login = async (
  _: unknown,
  { target, targetType }: { target: string; targetType: 'PHONE' | 'EMAIL' },
) => {
  const user = await userService.findByTarget(target, targetType);
  if (!user) throw new NotFoundError('User');

  await otpService.send(target, targetType);
  return { success: true, message: 'OTP sent' };
};
