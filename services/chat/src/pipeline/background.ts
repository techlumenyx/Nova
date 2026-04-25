import { logger } from '@nova/shared';
import { sessionService } from '../services/session.service';
import { getRegionalRisk } from './regionalRisk';
import { checkDrugInteractions } from './drugCheck';
import { buildPriorRiskProfile } from './riskFusion';
import type { IDiagnosisSession } from '../models/session.model';

type UserProfile = IDiagnosisSession['userProfile'];

/**
 * Runs Stages 2–4 in background after session creation.
 * Non-blocking — called without await from startSession resolver.
 * Each stage result is written to the session document as it completes.
 */
export async function runBackgroundStages(
  sessionId: string,
  userProfile: UserProfile,
): Promise<void> {
  try {
    // Stage 2 — Regional risk
    const regionalRisk = await getRegionalRisk(userProfile.city);
    await sessionService.update(sessionId, { regionalRisk } as any);

    // Stage 3 — Drug interaction check
    const drugFlags = checkDrugInteractions(userProfile.medications ?? []);

    // Stage 4 — Risk fusion
    const priorRiskProfile = buildPriorRiskProfile(userProfile, regionalRisk, drugFlags);
    await sessionService.update(sessionId, { priorRiskProfile, stage: 5 } as any);

    logger.info('[Pipeline] Background stages 2–4 complete', { sessionId });
  } catch (err) {
    logger.error('[Pipeline] Background stages failed', { sessionId, err });
    // Session stays at stage 1 — sendMessage will handle gracefully
  }
}
