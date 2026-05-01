import { AuthenticationError } from '@nova/shared';
import type { Context } from '../../context';
import { sessionService } from '../../services/session.service';
import { runBackgroundStages } from '../../pipeline/background';

/**
 * newSession — abandons any active IN_PROGRESS session and starts a fresh one.
 * Used when the user explicitly taps "New Chat" in the session drawer.
 */
export const newSession = async (_: unknown, __: unknown, ctx: Context) => {
  if (!ctx.userId) throw new AuthenticationError('Not authenticated');

  // Abandon the current active session if one exists
  const existing = await sessionService.getActiveByUser(ctx.userId);
  if (existing) {
    await sessionService.abandon(existing._id.toString());
  }

  // Profile check
  const missingFields: string[] = [];
  if (!ctx.profile?.age)  missingFields.push('dateOfBirth');
  if (!ctx.profile?.sex)  missingFields.push('gender');

  if (missingFields.length > 0) {
    return {
      __typename: 'ProfileIncompleteError',
      message: 'Please complete your profile before starting a session.',
      missingFields,
    };
  }

  const p = ctx.profile!;

  const userProfile: Parameters<typeof sessionService.create>[0]['userProfile'] = {
    name:        p.name,
    age:         p.age,
    sex:         p.sex,
    heightCm:    p.heightCm,
    weightKg:    p.weightKg,
    bmi:         p.bmi,
    language:    p.language ?? 'EN',
    city:        p.city,
    conditions:  p.conditions?.length  ? p.conditions  : undefined,
    medications: p.medications?.length ? p.medications : undefined,
    allergies:   p.allergies,
  };

  const session = await sessionService.create({
    userId:    ctx.userId,
    profileId: ctx.profileId,
    userProfile,
  });

  runBackgroundStages(session._id.toString(), userProfile).catch(() => {});

  return { __typename: 'DiagnosisSession', ...session.toObject(), id: session._id.toString() };
};
