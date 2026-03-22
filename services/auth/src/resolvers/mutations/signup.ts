import { otpService, userService } from '../../services';

export const signup = async (
  _: unknown,
  { input }: { input: { name: string; target: string; targetType: 'PHONE' | 'EMAIL'; language?: 'EN' | 'HI' | 'HINGLISH' } },
) => {
  await userService.create(input.name, input.target, input.targetType, input.language);
  await otpService.send(input.target, input.targetType);
  return { success: true, message: 'OTP sent' };
};
