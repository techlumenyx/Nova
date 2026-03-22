import { sessionService } from '../../services';

export const refreshToken = async (
  _: unknown,
  { refreshToken: token }: { refreshToken: string },
) => {
  return sessionService.refresh(token);
};
