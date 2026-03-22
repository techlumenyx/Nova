import { userService } from '../../services';
import type { Context } from '../../context';

export const me = async (_: unknown, __: unknown, ctx: Context) => {
  if (!ctx.userId) return null;
  return userService.getById(ctx.userId);
};
