import { AuthenticationError } from '@nova/shared';
import type { Context } from '../../context';
import { sessionService } from '../../services/session.service';
import { runBackgroundStages } from '../../pipeline/background';

export const startSession = async (_: unknown, __: unknown, ctx: Context) => {
  if (!ctx.userId) throw new AuthenticationError('Not authenticated');

  // ── Resume existing IN_PROGRESS session ───────────────────────────────────
  const existing = await sessionService.getActiveByUser(ctx.userId);
  if (existing) {
    const sessionId = existing._id.toString();

    // Add a re-entry message only when the conversation was underway and the
    // user is genuinely returning (not a rapid double-call within 30s).
    const conversationStarted = existing.stage >= 5 && existing.messages.length > 0;
    const isReturning = Date.now() - existing.updatedAt.getTime() > 30_000;

    if (conversationStarted && isReturning) {
      const lang = (existing.userProfile.language ?? 'EN').toUpperCase();
      const reEntryMsg = buildResumeMessage(lang, existing.symptomSet?.chiefComplaint);

      await sessionService.addMessage(sessionId, {
        role:      'assistant',
        content:   reEntryMsg,
        timestamp: new Date().toISOString(),
      });

      const refreshed = await sessionService.getById(sessionId);
      return { __typename: 'DiagnosisSession', ...refreshed!.toObject(), id: sessionId };
    }

    return { __typename: 'DiagnosisSession', ...existing.toObject(), id: sessionId };
  }

  // ── Stage 1 — Profile check ───────────────────────────────────────────────
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

// ─── Re-entry message ─────────────────────────────────────────────────────────

function buildResumeMessage(lang: string, chiefComplaint?: string): string {
  const topic = chiefComplaint ?? 'your symptoms';

  if (lang === 'HI') {
    return `आप वापस आ गए! पिछली बार हम ${topic} के बारे में बात कर रहे थे।` +
      ` क्या आप वहीं से जारी रखना चाहेंगे, या कुछ नया है जो आप बताना चाहते हैं?`;
  }
  if (lang === 'HINGLISH') {
    return `Welcome back! Last time hum ${topic} ke baare mein baat kar rahe the.` +
      ` Kya aap wahan se continue karna chahte hain, ya kuch naya hai?`;
  }
  return `Welcome back! We were last discussing ${topic}.` +
    ` Would you like to continue from where we left off, or is there something new you'd like to tell me?`;
}
