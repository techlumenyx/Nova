import { Request } from 'express';
import { verifyToken } from '@nova/shared';

export interface UserProfile {
  name: string;
  age: number;
  sex: string;
  heightCm?: number;
  weightKg?: number;
  bmi?: number;
  language?: string;
  city?: string;
  conditions?: string[];
  medications?: { name: string; dosage: string }[];
  allergies?: { drugs: string[]; food: string[]; environmental: string[] };
}

export interface Context {
  userId?: string;
  userTier?: string;
  profileId?: string;
  profile?: UserProfile;
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

  // Profile forwarded from gateway as JSON header
  let profile: UserProfile | undefined;
  const profileHeader = req.headers['x-user-profile'] as string | undefined;
  if (profileHeader) {
    try {
      profile = JSON.parse(profileHeader);
    } catch {
      // malformed header — ignore
    }
  }

  return { userId, userTier, profileId, profile };
}
