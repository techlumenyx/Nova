import { otpService, userService, sessionService } from '../../services';
import { ValidationError } from '@nova/shared';
import { validateTarget, validateOTP } from '../../utils/validate';

export const verifyOTP = async (
  _: unknown,
  { target, targetType, otp }: { target: string; targetType: 'PHONE' | 'EMAIL'; otp: string },
) => {
  validateTarget(target, targetType);
  validateOTP(otp);

  const { signupName, signupLanguage } = await otpService.verify(target, targetType, otp);

  let user = await userService.findByTarget(target, targetType);

  if (!user) {
    // This is a signup flow — create user now that OTP is verified
    if (!signupName) throw new ValidationError('Signup session expired. Please sign up again.');
    user = await userService.create(
      signupName,
      target,
      targetType,
      (signupLanguage as 'EN' | 'HI' | 'HINGLISH') ?? 'EN',
    );
  }

  await userService.markVerified(target, targetType);

  const tokens = await sessionService.create(user.id);
  return { ...tokens, user };
};
