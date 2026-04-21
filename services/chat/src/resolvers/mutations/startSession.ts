import { AuthenticationError } from '@nova/shared';
import type { Context } from '../../context';
import { sessionService } from '../../services/session.service';
import { runBackgroundStages } from '../../pipeline/background';

export const startSession = async (_: unknown, __: unknown, ctx: Context) => {
  if (!ctx.userId) throw new AuthenticationError('Not authenticated');

  // Return existing IN_PROGRESS session if one exists
  const existing = await sessionService.getActiveByUser(ctx.userId);
  if (existing) {
    return { __typename: 'DiagnosisSession', ...existing.toObject(), id: existing._id.toString() };
  }

  // Stage 1 — Profile check
  // Profile fields are forwarded from gateway via x-user-profile header
  const missingFields: string[] = [];
  if (!ctx.profile?.age) missingFields.push('dateOfBirth');
  if (!ctx.profile?.sex) missingFields.push('gender');

  if (missingFields.length > 0) {
    return {
      __typename: 'ProfileIncompleteError',
      message: 'Please complete your profile before starting a session.',
      missingFields,
    };
  }

  const p = ctx.profile!;

  // Build profile snapshot
  const userProfile: Parameters<typeof sessionService.create>[0]['userProfile'] = {
    name:     p.name,
    age:      p.age,
    sex:      p.sex,
    heightCm: p.heightCm,
    weightKg: p.weightKg,
    bmi:      p.bmi,
    language: p.language ?? 'EN',
    city:     p.city,
  };

  const session = await sessionService.create({
    userId:    ctx.userId,
    profileId: ctx.profileId,
    userProfile,
  });

  // Fire Stages 2–4 in background — do not await
  runBackgroundStages(session._id.toString(), userProfile).catch(() => {
    // failures handled inside runBackgroundStages
  });

  return { __typename: 'DiagnosisSession', ...session.toObject(), id: session._id.toString() };
};
