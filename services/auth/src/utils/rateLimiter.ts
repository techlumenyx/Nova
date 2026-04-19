import { createClient } from 'redis';
import { RateLimitError } from '@nova/shared';

const redis = createClient({ 
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  disableOfflineQueue: true 
});
redis.connect().catch(() => {}); // non-fatal if Redis is unavailable

// Max attempts per window per IP
const LIMITS: Record<string, { max: number; windowSecs: number }> = {
  signup: { max: 5,  windowSecs: 3600 }, // 5 signups per hour per IP
  login:  { max: 10, windowSecs: 900  }, // 10 logins per 15min per IP
};

export async function checkRateLimit(action: 'signup' | 'login', ip: string): Promise<void> {
  try {
    const { max, windowSecs } = LIMITS[action];
    const key   = `ratelimit:${action}:${ip}`;
    const count = await redis.incr(key);

    if (count === 1) await redis.expire(key, windowSecs);
    if (count > max) throw new RateLimitError();
  } catch (e) {
    if (e instanceof RateLimitError) throw e;
    // If Redis is down, allow the request through — don't block users
  }
}
