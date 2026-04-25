import { withFilter } from 'graphql-subscriptions';
import { AuthenticationError, ValidationError } from '@nova/shared';
import { pubsub, SESSION_UPDATED } from '../../lib/pubsub';
import { sessionService } from '../../services/session.service';

export const sessionUpdated = {
  subscribe: withFilter(
    // Iterator factory — runs once per new subscription
    () => pubsub.asyncIterableIterator(SESSION_UPDATED),

    // Filter — called for every published event; return true to forward it
    async (payload: any, variables: any, ctx: any): Promise<boolean> => {
      if (!ctx?.userId) throw new AuthenticationError('Not authenticated');
      if (!variables?.sessionId) return false;

      // Ownership check
      const session = await sessionService.getById(variables.sessionId as string);
      if (!session || session.userId !== ctx.userId) {
        throw new ValidationError('Session not found');
      }

      return (payload?.sessionUpdated?.sessionId ?? '') === variables.sessionId;
    },
  ),
};
