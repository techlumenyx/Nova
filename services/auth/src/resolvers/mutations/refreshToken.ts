import { sessionService } from '../../services';

export const refreshToken = async (
  _: unknown,
  { token }: { token: string },
) => {
  return sessionService.refresh(token);
};
