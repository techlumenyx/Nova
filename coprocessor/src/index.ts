import express from 'express';
import { createClient } from 'redis';
import { logger } from '@nova/shared';

const PORT = process.env.PORT || 4010;

// Rate limits per tier (requests per minute)
const QUERY_LIMITS: Record<string, number> = {
  FREE:   100,
  SILVER: 300,
  GOLD:   1000,
};

const redis = createClient({ 
  url: process.env.REDIS_URL || 'redis://redis:6379',
  disableOfflineQueue: true
});

redis.on('error', (err) => logger.error('Redis error', { error: err }));

const app = express();
app.use(express.json());

// Apollo Router coprocessor protocol
// https://www.apollographql.com/docs/router/customizations/coprocessor
app.post('/', async (req, res) => {
  const body = req.body as {
    version: number;
    stage: string;
    control: string;
    headers?: Record<string, string[]>;
    body?: string;
  };

  // Only intercept RouterRequest stage
  if (body.stage !== 'RouterRequest') {
    return res.json(body);
  }

  const userId = body.headers?.['x-user-id']?.[0];
  const tier = (body.headers?.['x-user-tier']?.[0] ?? 'FREE').toUpperCase();

  // No userId = unauthenticated, let the subgraph handle auth errors
  if (!userId) {
    return res.json(body);
  }

  // Per-minute query rate limit
  const minuteKey = `ratelimit:${userId}:queries:${Math.floor(Date.now() / 60_000)}`;
  const count = await redis.incr(minuteKey);
  await redis.expire(minuteKey, 60);

  const limit = QUERY_LIMITS[tier] ?? QUERY_LIMITS.FREE;

  if (count > limit) {
    logger.warn('Rate limit exceeded', { userId, tier, count, limit });
    return res.json({
      ...body,
      control: { break: 429 },
      body: JSON.stringify({
        errors: [{ message: 'Rate limit exceeded. Upgrade your plan for higher limits.' }],
      }),
    });
  }

  return res.json(body);
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'coprocessor' });
});

async function start() {
  await redis.connect();
  app.listen(PORT, () => {
    logger.info(`Coprocessor running on port ${PORT}`);
  });
}

start().catch((err) => {
  logger.error('Failed to start coprocessor', { error: err });
  process.exit(1);
});
