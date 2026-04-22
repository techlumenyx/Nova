import Redis from 'ioredis';
import { logger } from '@nova/shared';

let client: Redis | null = null;
let unavailable = false;

export function getRedis(): Redis | null {
  if (unavailable) return null;
  if (client) return client;

  const url = process.env.REDIS_URL;
  if (!url) {
    logger.warn('[Redis] REDIS_URL not set — caching disabled');
    unavailable = true;
    return null;
  }

  client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1, enableOfflineQueue: false });
  client.on('error', (err) => {
    logger.warn('[Redis] unavailable — caching disabled', { code: (err as any).code });
    unavailable = true;
    client = null;
  });
  return client;
}
