import { labTestService } from '../../services';
import { AuthenticationError } from '@nova/shared';
import type { Context } from '../../context';

export const labTestSuggestions = (
  _: unknown,
  { query }: { query: string },
  ctx: Context,
) => {
  if (!ctx.userId) throw new AuthenticationError('Not authenticated');
  return labTestService.suggestions(query);
};
