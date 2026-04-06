import { Request } from 'express';

export interface Context {
  userId?:    string;
  userTier?:  string;
  profileId?: string;
  ip:         string;
}

export function buildContext({ req }: { req: Request }): Context {
  return {
    userId:    req.headers['x-user-id']    as string | undefined,
    userTier:  req.headers['x-user-tier']  as string | undefined,
    profileId: req.headers['x-profile-id'] as string | undefined,
    ip:        (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.socket.remoteAddress ?? 'unknown',
  };
}
