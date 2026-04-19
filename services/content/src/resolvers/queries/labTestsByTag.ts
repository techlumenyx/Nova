import { labTestService } from '../../services';
import { AuthenticationError } from '@nova/shared';
import type { Context } from '../../context';

export const labTestsByTag = (
  _: unknown,
  { tag, limit }: { tag: string; limit?: number },
  ctx: Context,
) => {
  if (!ctx.userId) throw new AuthenticationError('Not authenticated');
  return labTestService.getByTag(tag, limit);
};
