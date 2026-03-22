import { otpService, userService, sessionService } from '../../services';
import { NotFoundError } from '@nova/shared';

export const verifyOTP = async (
  _: unknown,
  { target, targetType, otp }: { target: string; targetType: 'PHONE' | 'EMAIL'; otp: string },
) => {
  await otpService.verify(target, targetType, otp);

  const user = await userService.findByTarget(target, targetType);
  if (!user) throw new NotFoundError('User');

  await userService.markVerified(target, targetType);

  const tokens = await sessionService.create(user.id);
  return { ...tokens, user };
};
