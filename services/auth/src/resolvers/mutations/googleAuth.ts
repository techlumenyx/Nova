import { userService, sessionService } from '../../services';

export const googleAuth = async (
  _: unknown,
  { idToken, language }: { idToken: string; language?: 'EN' | 'HI' | 'HINGLISH' },
) => {
  const user = await userService.googleAuth(idToken, language);
  const tokens = await sessionService.create(user.id);
  return { ...tokens, user };
};
