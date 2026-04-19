import { Request } from 'express';
import { verifyToken } from '@nova/shared';

export interface Context {
  userId?: string;
  userTier?: string;
  profileId?: string;
}

export function buildContext({ req }: { req: Request }): Context {
  let userId   = req.headers['x-user-id']   as string | undefined;
  let userTier = req.headers['x-user-tier'] as string | undefined;
  const profileId = req.headers['x-profile-id'] as string | undefined;

  if (!userId) {
    const auth = req.headers['authorization'];
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;
    if (token) {
      try {
        const payload = verifyToken(token, process.env.JWT_SECRET!);
        userId   = payload.userId;
        userTier = payload.tier;
      } catch {
        // invalid token — leave userId undefined
      }
    }
  }

  return { userId, userTier, profileId };
}
