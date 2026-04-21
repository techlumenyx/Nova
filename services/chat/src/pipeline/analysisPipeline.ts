/**
 * Analysis Pipeline — Stages 7–10
 *
 * Runs after the conversation loop concludes (7 questions answered).
 * Executes sequentially:
 *   Stage 7  → Differential scoring (LLM)
 *   Stage 8  → Lab test mapping (static)
 *   Stage 4.4→ Remedy retrieval (Pinecone)
 *   Stage 9  → Safety guardrail (regex + optional OpenAI moderation)
 *   Stage 10 → Build + persist DiagnosisOutput, complete session
 *
 * Returns the formatted chat message and final session state.
 */

import { logger } from '@nova/shared';
import { sessionService } from '../services/session.service';
import { runDifferential } from './differential';
import { mapLabTests } from './labTests';
import { retrieveRemedies } from './remedyRetrieval';
import { applyLayer1, applyLayer2, blockedFallback } from './safetyGuardrail';
import {
  buildOutput,
  deriveSeverity,
  formatOutputMessage,
} from './outputBuilder';
import type { IDiagnosisSession } from '../models/session.model';
import type { LoopResult } from './conversationLoop';

export async function runAnalysisPipeline(
  session: IDiagnosisSession,
  sessionId: string,
): Promise<LoopResult> {
  logger.info('[AnalysisPipeline] Starting stages 7–10', { sessionId });

  // ── Stage 7: Differential ─────────────────────────────────────────────────
  let diff;
  try {
    diff = await runDifferential(session);
    await sessionService.update(sessionId, {
      differentialDiagnosis: diff,
      stage: 8,
    } as any);
    logger.info('[AnalysisPipeline] Stage 7 done', {
      sessionId,
      topCondition: diff.probableCauses[0]?.condition,
    });
  } catch (err) {
    logger.error('[AnalysisPipeline] Stage 7 failed', { err, sessionId });
    const msg = fallbackOutputMessage(session.userProfile.language);
    return { message: msg, stage: 10, status: 'COMPLETED', requiresAction: 'NONE' };
  }

  // ── Stage 8: Lab tests ────────────────────────────────────────────────────
  const severity = deriveSeverity(diff, session.redFlagTriggered);
  const labTests = mapLabTests(diff, severity);

  await sessionService.update(sessionId, { stage: 9 } as any);

  // ── Stage 4.4: Remedy retrieval ───────────────────────────────────────────
  const remedies = await retrieveRemedies(session);

  // ── Stage 10: Build output ────────────────────────────────────────────────
  const output  = buildOutput(session, diff, remedies, labTests);
  let formatted = formatOutputMessage(output);

  // ── Stage 9: Safety guardrail ─────────────────────────────────────────────
  const { text: cleanedText, flagged } = applyLayer1(formatted);
  if (flagged.length) {
    logger.warn('[AnalysisPipeline] Layer 1 redactions applied', { flagged, sessionId });
  }
  formatted = cleanedText;

  const layer2ok = await applyLayer2(formatted, sessionId);
  if (!layer2ok) {
    logger.warn('[AnalysisPipeline] Layer 2 blocked output', { sessionId });
    formatted = blockedFallback(session.userProfile.language);
  }

  // ── Persist output + complete session ────────────────────────────────────
  const followUpScheduled = new Date(Date.now() + 48 * 60 * 60 * 1000); // +48hr

  await Promise.all([
    sessionService.update(sessionId, {
      output,
      stage: 10,
      status: 'COMPLETED',
      followUpScheduled,
    } as any),
    sessionService.addMessage(sessionId, {
      role: 'assistant',
      content: formatted,
      timestamp: new Date().toISOString(),
    }),
  ]);

  logger.info('[AnalysisPipeline] Session completed', {
    sessionId,
    severity,
    action: output.action,
    followUpScheduled,
  });

  return {
    message: formatted,
    stage: 10,
    status: 'COMPLETED',
    requiresAction: output.action === 'ER_NOW' ? 'EMERGENCY' : 'NONE',
  };
}

function fallbackOutputMessage(language?: string): string {
  const lang = (language ?? 'EN').toUpperCase();
  if (lang === 'HI') {
    return 'मुझे विश्लेषण पूरा करने में समस्या हुई। कृपया किसी डॉक्टर से मिलें।';
  }
  if (lang === 'HINGLISH') {
    return 'Analysis mein problem aayi. Please ek doctor se milein.';
  }
  return 'I encountered an issue completing the analysis. Please consult a doctor directly for guidance.';
}
