import express from 'express';
import { logger } from '@nova/shared';

const PORT = process.env.PORT || 4010;
const PROFILE_SERVICE_URL = process.env.PROFILE_SERVICE_URL || 'http://localhost:4002/graphql';

// ── Rate limiting (in-memory, replace with Redis when available) ────────────

const QUERY_LIMITS: Record<string, number> = {
  FREE:   100,
  SILVER: 300,
  GOLD:   1000,
};

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string, tier: string): boolean {
  const limit = QUERY_LIMITS[tier] ?? QUERY_LIMITS.FREE;
  const now   = Date.now();
  const entry = rateLimitStore.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  entry.count++;
  return entry.count <= limit;
}

// ── Profile cache (30s TTL per userId) ──────────────────────────────────────

const profileCache = new Map<string, { data: any; expiresAt: number }>();

async function fetchProfile(userId: string, authHeader?: string): Promise<any | null> {
  const cached = profileCache.get(userId);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-user-id': userId,
    };
    if (authHeader) headers['authorization'] = authHeader;

    const res = await fetch(PROFILE_SERVICE_URL, {
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

    if (!res.ok) return null;
    const json = await res.json() as any;
    const profile = json?.data?.myProfile ?? null;
    profileCache.set(userId, { data: profile, expiresAt: Date.now() + 30_000 });
    return profile;
  } catch (err) {
    logger.warn('[Coprocessor] Profile fetch failed — continuing without profile', { userId, err });
    return null;
  }
}

function buildProfileHeader(profile: any): string {
  if (!profile) return JSON.stringify({});

  const heightCm = profile.heightValue
    ? profile.heightUnit === 'FEET'
      ? Math.round(profile.heightValue * 30.48)
      : profile.heightValue
    : undefined;

  const weightKg = profile.weightValue
    ? profile.weightUnit === 'LBS'
      ? Math.round(profile.weightValue * 0.453592)
      : profile.weightValue
    : undefined;

  const age = profile.dateOfBirth
    ? Math.floor((Date.now() - new Date(profile.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))
    : undefined;

  return JSON.stringify({
    age,
    sex:        profile.gender   ?? 'OTHER',
    language:   profile.language ?? 'EN',
    city:       profile.city,
    heightCm,
    weightKg,
    bmi:        profile.bmi,
    conditions:  profile.conditions  ?? [],
    medications: profile.medications ?? [],
    allergies:   profile.allergies,
  });
}

// ── Express app ──────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

app.post('/', async (req, res) => {
  const body = req.body as {
    version:  number;
    stage:    string;
    control:  string;
    headers?: Record<string, string[]>;
    body?:    string;
  };

  if (body.stage !== 'RouterRequest') return res.json(body);

  const userId     = body.headers?.['x-user-id']?.[0];
  const tier       = (body.headers?.['x-user-tier']?.[0] ?? 'FREE').toUpperCase();
  const authHeader = body.headers?.['authorization']?.[0];

  if (!userId) return res.json(body);

  // Rate limit check
  if (!checkRateLimit(userId, tier)) {
    logger.warn('[Coprocessor] Rate limit exceeded', { userId, tier });
    return res.json({
      ...body,
      control: { break: 429 },
      body: JSON.stringify({
        errors: [{ message: 'Rate limit exceeded. Upgrade your plan for higher limits.' }],
      }),
    });
  }

  // Inject x-user-profile from profile service
  const profile = await fetchProfile(userId, authHeader);
  const profileHeader = buildProfileHeader(profile);

  return res.json({
    ...body,
    headers: {
      ...body.headers,
      'x-user-profile': [profileHeader],
    },
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'coprocessor' });
});

app.listen(Number(PORT), () => {
  logger.info(`Coprocessor running on port ${PORT}`);
});
