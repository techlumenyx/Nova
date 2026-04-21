import { AuthenticationError } from '@nova/shared';
import type { Context } from '../../context';
import { sessionService } from '../../services/session.service';

export const activeSession = async (_: unknown, __: unknown, ctx: Context) => {
  if (!ctx.userId) throw new AuthenticationError('Not authenticated');
  const session = await sessionService.getActiveByUser(ctx.userId);
  if (!session) return null;
  return { ...session.toObject(), id: session._id.toString() };
};

export const session = async (_: unknown, { id }: { id: string }, ctx: Context) => {
  if (!ctx.userId) throw new AuthenticationError('Not authenticated');
  const s = await sessionService.getById(id);
  if (!s || s.userId !== ctx.userId) return null;
  return { ...s.toObject(), id: s._id.toString() };
};

export const sessionHistory = async (
  _: unknown,
  { limit, offset }: { limit?: number; offset?: number },
  ctx: Context,
) => {
  if (!ctx.userId) throw new AuthenticationError('Not authenticated');
  const sessions = await sessionService.getHistoryByUser(ctx.userId, limit, offset);
  return sessions.map(s => ({ ...s.toObject(), id: s._id.toString() }));
};
