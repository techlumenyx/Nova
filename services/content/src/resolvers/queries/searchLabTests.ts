import { labTestService } from '../../services';
import { logger } from '@nova/shared';

export const searchLabTests = async (
  _: unknown,
  { query, limit }: { query: string; limit?: number },
) => {
  logger.info('[searchLabTests] resolver called', { query, limit });
  const result = await labTestService.search(query, limit);
  logger.info('[searchLabTests] result', { testCount: result.tests.length, packageCount: result.packages.length });
  return result;
};
