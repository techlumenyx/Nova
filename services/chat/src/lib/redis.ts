import { logger } from '@nova/shared';

// Redis is optional. If REDIS_URL is not set or connection fails, all cache
// operations are no-ops. Set REDIS_URL to re-enable.

export function getRedis(): null {
  if (process.env.REDIS_URL) {
    logger.info('[Redis] REDIS_URL is set but Redis is currently disabled — remove this stub to re-enable');
  }
  return null;
}
