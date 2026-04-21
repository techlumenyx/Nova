import { AuthenticationError, ValidationError } from '@nova/shared';
import type { Context } from '../../context';
import { sessionService } from '../../services/session.service';

export const submitFollowUp = async (
  _: unknown,
  { sessionId, outcome, doctorDiagnosis }: { sessionId: string; outcome: string; doctorDiagnosis?: string },
  ctx: Context,
) => {
  if (!ctx.userId) throw new AuthenticationError('Not authenticated');

  const session = await sessionService.getById(sessionId);
  if (!session || session.userId !== ctx.userId) {
    throw new ValidationError('Session not found');
  }

  const followUpResponse = {
    answeredAt: new Date().toISOString(),
    outcome,
    ...(doctorDiagnosis && { doctorDiagnosis }),
  };

  // WORSENED — reopen session from Stage 5 with previous context
  if (outcome === 'WORSENED') {
    const updated = await sessionService.update(sessionId, {
      status: 'IN_PROGRESS',
      stage: 5,
      followUpResponse,
      questionCount: 0,
      redFlagTriggered: false,
    } as any);
    return { ...updated!.toObject(), id: updated!._id.toString() };
  }

  const updated = await sessionService.update(sessionId, {
    followUpResponse,
  } as any);

  return { ...updated!.toObject(), id: updated!._id.toString() };
};
