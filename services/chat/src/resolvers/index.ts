import { startSession } from './mutations/startSession';
import { sendMessage } from './mutations/sendMessage';
import { submitFollowUp } from './mutations/submitFollowUp';
import { activeSession, session, sessionHistory } from './queries/session';
import { sessionUpdated } from './subscriptions/sessionUpdated';

export const resolvers: Record<string, any> = {
  Query: {
    activeSession,
    session,
    sessionHistory,
  },
  Mutation: {
    startSession,
    sendMessage,
    submitFollowUp,
  },
  Subscription: {
    sessionUpdated,
  },
  StartSessionResult: {
    __resolveType(obj: any) {
      return obj.__typename;
    },
  },
};
