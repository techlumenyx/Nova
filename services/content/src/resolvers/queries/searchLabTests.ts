import { labTestService } from '../../services';
import { logger, AuthenticationError } from '@nova/shared';
import type { Context } from '../../context';

export const searchLabTests = async (
  _: unknown,
  { query, limit }: { query: string; limit?: number },
  ctx: Context,
) => {
  if (!ctx.userId) throw new AuthenticationError('Not authenticated');
  logger.info('[searchLabTests] resolver called', { query, limit });
  const result = await labTestService.search(query, limit);
  logger.info('[searchLabTests] result', { testCount: result.tests.length, packageCount: result.packages.length });
  return result;
};
