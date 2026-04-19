import { labTestService } from '../../services';
import { logger } from '@nova/shared';
import mongoose from 'mongoose';

export const searchLabTests = async (
  _: unknown,
  { query, limit }: { query: string; limit?: number },
) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  logger.info('[searchLabTests] resolver called', { query, limit, mongoState: states[mongoose.connection.readyState] });
  const result = await labTestService.search(query, limit);
  logger.info('[searchLabTests] result', { testCount: result.tests.length, packageCount: result.packages.length });
  return result;
};
