import { AuthenticationError, ValidationError, logger } from '@nova/shared';
import type { Context } from '../../context';
import { sessionService } from '../../services/session.service';
import { runConversationLoop } from '../../pipeline/conversationLoop';
import { runAnalysisPipeline } from '../../pipeline/analysisPipeline';

export const sendMessage = async (
  _: unknown,
  { sessionId, message }: { sessionId: string; message: string },
  ctx: Context,
) => {
  if (!ctx.userId) throw new AuthenticationError('Not authenticated');

  if (!message?.trim()) throw new ValidationError('Message cannot be empty');

  const session = await sessionService.getById(sessionId);
  if (!session || session.userId !== ctx.userId) {
    throw new ValidationError('Session not found');
  }
  if (session.status === 'ABANDONED') {
    throw new ValidationError('Session has been abandoned due to technical issues. Please start a new session.');
  }
  if (session.status !== 'IN_PROGRESS') {
    throw new ValidationError('Session is not active');
  }

  // Fire pipeline asynchronously — client receives events via subscription
  setImmediate(() => {
    const pipeline =
      session.stage === 7 && !session.differentialDiagnosis
        ? runAnalysisPipeline(session, sessionId)
        : runConversationLoop(session, message.trim());

    pipeline.catch((err: unknown) => {
      logger.error('[sendMessage] Unhandled pipeline error', { err, sessionId });
    });
  });

  return { accepted: true, sessionId };
};
