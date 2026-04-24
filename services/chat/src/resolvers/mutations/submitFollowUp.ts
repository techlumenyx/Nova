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
    // Store previous session summary so buildSystemPrompt can surface it
    previousChiefComplaint: session.symptomSet?.chiefComplaint,
    previousTopCondition:   session.differentialDiagnosis?.probableCauses[0]?.condition,
  };

  if (outcome === 'WORSENED') {
    const lang = (session.userProfile.language ?? 'EN').toUpperCase();
    const reEntryMsg = buildReEntryMessage(
      lang,
      followUpResponse.previousChiefComplaint,
      followUpResponse.previousTopCondition,
    );

    const updated = await sessionService.update(sessionId, {
      // Reopen for a fresh interview
      status:           'IN_PROGRESS',
      stage:            5,
      questionCount:    0,
      redFlagTriggered: false,
      llmFailureCount:  0,

      // Record the follow-up (carries previousChiefComplaint + previousTopCondition)
      followUpResponse,

      // Clear stale analysis state — fresh differential will be built
      differentialDiagnosis: null,
      output:                null,
      followUpScheduled:     null,
      followUpDue:           false,

      // Clear symptom state — new interview collects fresh SOCRATES
      symptomSet: null,

      // Seed messages with one re-entry prompt so LLM has immediate context
      messages: [
        {
          role:      'assistant',
          content:   reEntryMsg,
          timestamp: new Date().toISOString(),
        },
      ],
    } as any);

    return { ...updated!.toObject(), id: updated!._id.toString() };
  }

  // IMPROVED / SAME / SAW_DOCTOR — just record the response
  const updated = await sessionService.update(sessionId, { followUpResponse } as any);
  return { ...updated!.toObject(), id: updated!._id.toString() };
};

// ─── Re-entry messages ────────────────────────────────────────────────────────

function buildReEntryMessage(
  lang: string,
  prevComplaint?: string,
  prevCondition?: string,
): string {
  const complaint  = prevComplaint  ?? 'your previous symptoms';
  const condition  = prevCondition  ?? 'the possible condition we discussed';

  if (lang === 'HI') {
    return `आपने बताया कि ${complaint} के बाद आपकी तबीयत और खराब हो गई है।` +
      ` पहले हमने ${condition} की संभावना पर चर्चा की थी।` +
      ` मुझे अभी आपके लक्षणों के बारे में थोड़ा और जानना है — अभी सबसे ज़्यादा क्या परेशान कर रहा है?`;
  }
  if (lang === 'HINGLISH') {
    return `Aapne bataya ki ${complaint} ke baad aap worse feel kar rahe hain.` +
      ` Pehle humne ${condition} ki possibility discuss ki thi.` +
      ` Main aapke current symptoms samajhna chahta hoon — abhi sabse zyada kya problem ho rahi hai?`;
  }
  return `I see that things have gotten worse since we last spoke about ${complaint}.` +
    ` We had discussed the possibility of ${condition}.` +
    ` Let me do a fresh assessment — what is bothering you the most right now?`;
}
