import { sessionService } from '../../services';
import type { Context } from '../../context';

export const logout = async (_: unknown, __: unknown, ctx: Context) => {
  if (ctx.userId) await sessionService.revoke(ctx.userId);
  return true;
};
