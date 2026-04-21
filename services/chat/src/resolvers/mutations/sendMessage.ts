import { AuthenticationError, ValidationError } from '@nova/shared';
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

  // Stage 7 means conversation is done but analysis hasn't run yet (edge case: mid-flight).
  // Re-trigger analysis on any message rather than looping back into questions.
  if (session.stage === 7 && !session.differentialDiagnosis) {
    const sessionIdStr = (session._id as unknown as string).toString();
    return runAnalysisPipeline(session, sessionIdStr);
  }

  return runConversationLoop(session, message.trim());
};
