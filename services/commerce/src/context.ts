import { Request } from 'express';

export interface Context {
  userId?: string;
  userTier?: string;
  profileId?: string;
}

export function buildContext({ req }: { req: Request }): Context {
  return {
    userId: req.headers['x-user-id'] as string | undefined,
    userTier: req.headers['x-user-tier'] as string | undefined,
    profileId: req.headers['x-profile-id'] as string | undefined,
  };
}
