import Redis from 'ioredis';
import { logger } from '@nova/shared';

let client: Redis | null = null;

export function getRedis(): Redis {
  if (client) return client;
  const url = process.env.REDIS_URL;
  if (!url) throw new Error('REDIS_URL is not set');
  client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 2 });
  client.on('error', (err) => logger.error('[Redis] connection error', { err }));
  return client;
}
