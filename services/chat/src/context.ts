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

const PROFILE_URL = process.env.PROFILE_SERVICE_URL || 'http://localhost:4002/graphql';

/** Fetch profile directly from profile service — fallback when coprocessor is not running. */
async function fetchProfile(userId: string, token?: string): Promise<UserProfile | undefined> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-user-id': userId,
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(PROFILE_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: `{
          myProfile {
            id userId gender city language
            heightValue weightValue heightUnit weightUnit bmi
            dateOfBirth isComplete conditions
            medications { name dosage }
            allergies { drugs food environmental }
          }
        }`,
      }),
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) return undefined;
    const json = await res.json() as any;
    const p = json?.data?.myProfile;
    if (!p) return undefined;

    // Compute age from dateOfBirth
    let age: number | undefined;
    if (p.dateOfBirth) {
      const dob = new Date(p.dateOfBirth);
      const now = new Date();
      age = now.getFullYear() - dob.getFullYear() -
        (now < new Date(now.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0);
    }

    return {
      name:        p.name ?? '',
      age:         age ?? 0,
      sex:         p.gender ?? '',
      heightCm:    p.heightValue ?? undefined,
      weightKg:    p.weightValue ?? undefined,
      bmi:         p.bmi ?? undefined,
      language:    p.language ?? 'EN',
      city:        p.city ?? undefined,
      conditions:  p.conditions ?? [],
      medications: p.medications ?? [],
      allergies:   p.allergies ?? undefined,
    };
  } catch {
    return undefined;
  }
}

export async function buildContext({ req }: { req: Request }): Promise<Context> {
  let userId   = req.headers['x-user-id']   as string | undefined;
  let userTier = req.headers['x-user-tier'] as string | undefined;
  const profileId = req.headers['x-profile-id'] as string | undefined;

  let token: string | undefined;
  if (!userId) {
    const auth = req.headers['authorization'];
    token = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;
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

  // 1. Try the header injected by the coprocessor (production path)
  let profile: UserProfile | undefined;
  const profileHeader = req.headers['x-user-profile'] as string | undefined;
  if (profileHeader) {
    try { profile = JSON.parse(profileHeader); } catch { /* ignore */ }
  }

  // 2. Fallback: fetch directly from profile service (local dev without coprocessor)
  if (!profile && userId) {
    profile = await fetchProfile(userId, token);
  }

  return { userId, userTier, profileId, profile };
}
