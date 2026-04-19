import { labTestService } from '../../services';
import { AuthenticationError } from '@nova/shared';
import type { Context } from '../../context';

export const labTest = (
  _: unknown,
  { slug }: { slug: string },
  ctx: Context,
) => {
  if (!ctx.userId) throw new AuthenticationError('Not authenticated');
  return labTestService.getBySlug(slug);
};
