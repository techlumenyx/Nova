/**
 * Stage 5 — LLM Conversation Loop
 *
 * Orchestrates the multi-turn symptom interview:
 *   1. Passive red-flag scan on every user message
 *   2. Background-stage readiness check (stage >= 5)
 *   3. Build system prompt from current session state
 *   4. Rolling 4-exchange window sent to Gemini
 *   5. Parse LLM signals: [EMERGENCY_ESCALATE] | [ANALYSIS_READY]
 *   6. Persist message + incremental symptom state updates
 */

import { logger } from '@nova/shared';
import { sessionService } from '../services/session.service';
import { callLLM } from './llm';
import { scanRedFlags } from './redFlags';
import { buildSystemPrompt } from './systemPrompt';
import { runAnalysisPipeline } from './analysisPipeline';
import { publishSessionEvent } from '../lib/pubsub';
import type { IDiagnosisSession, SessionMessage } from '../models/session.model';
import type { LLMMessage } from './llm';

const MAX_LLM_FAILURES = 3;

export interface LoopResult {
  message: string;
  stage: number;
  status: string;
  requiresAction: string;
}

export async function runConversationLoop(
  session: IDiagnosisSession,
  userMessage: string,
): Promise<LoopResult> {
  const sessionId = (session._id as unknown as string).toString();

  // ── 1. Passive red-flag scan ──────────────────────────────────────────────
  const redFlags = scanRedFlags(userMessage);
  if (redFlags.length > 0) {
    logger.warn('[ConversationLoop] Red flags in user message', { redFlags, sessionId });

    await sessionService.addMessage(sessionId, {
      role: 'user',
      content: userMessage,
      timestamp: now(),
    });

    const emergencyMsg = buildEmergencyMessage(session.userProfile.language, redFlags);

    await Promise.all([
      sessionService.update(sessionId, {
        redFlagTriggered: true,
        escalationReason: redFlags.join(', '),
        status: 'ESCALATED',
        stage: 6,
      } as any),
      sessionService.addMessage(sessionId, {
        role: 'assistant',
        content: emergencyMsg,
        timestamp: now(),
      }),
    ]);

    publishSessionEvent({ sessionId, type: 'ESCALATED', message: emergencyMsg, stage: 6, status: 'ESCALATED', requiresAction: 'EMERGENCY' });
    return { message: emergencyMsg, stage: 6, status: 'ESCALATED', requiresAction: 'EMERGENCY' };
  }

  // ── 2. Save user message ──────────────────────────────────────────────────
  await sessionService.addMessage(sessionId, {
    role: 'user',
    content: userMessage,
    timestamp: now(),
  });

  // ── 3. Background stage readiness check ──────────────────────────────────
  if (session.stage < 5) {
    const waitMsg = getWaitMessage(session.userProfile.language);
    await sessionService.addMessage(sessionId, {
      role: 'assistant',
      content: waitMsg,
      timestamp: now(),
    });
    return { message: waitMsg, stage: session.stage, status: 'IN_PROGRESS', requiresAction: 'NONE' };
  }

  // ── 4. Build LLM context ──────────────────────────────────────────────────
  const systemPrompt  = buildSystemPrompt(session);
  const rollingWindow = buildRollingWindow(session.messages);

  // ── 5. LLM call with failure handling ────────────────────────────────────
  let assistantText: string;
  try {
    assistantText = await callLLM(systemPrompt, rollingWindow, userMessage);
  } catch (err) {
    logger.error('[ConversationLoop] LLM call exhausted retries', { err, sessionId });
    const updated = await sessionService.incrementLLMFailure(sessionId);
    const failCount = updated?.llmFailureCount ?? MAX_LLM_FAILURES;

    if (failCount >= MAX_LLM_FAILURES) {
      await sessionService.update(sessionId, { status: 'ABANDONED' } as any);
      return {
        message: 'I\'m unable to continue right now due to a technical issue. Please try again later or consult a doctor directly.',
        stage: session.stage,
        status: 'ABANDONED',
        requiresAction: 'NONE',
      };
    }

    const retryMsg = getRetryMessage(session.userProfile.language);
    await sessionService.addMessage(sessionId, {
      role: 'assistant',
      content: retryMsg,
      timestamp: now(),
    });
    return { message: retryMsg, stage: session.stage, status: 'IN_PROGRESS', requiresAction: 'NONE' };
  }

  // ── 6. Parse LLM signals ──────────────────────────────────────────────────
  const isEmergency    = assistantText.includes('[EMERGENCY_ESCALATE]');
  const analysisReady  = assistantText.includes('[ANALYSIS_READY]');

  // Strip control tokens before sending to client
  assistantText = assistantText
    .replace('[EMERGENCY_ESCALATE]', '')
    .replace('[ANALYSIS_READY]', '')
    .trim();

  if (isEmergency) {
    await Promise.all([
      sessionService.update(sessionId, {
        redFlagTriggered: true,
        escalationReason: 'LLM detected emergency in conversation',
        status: 'ESCALATED',
        stage: 6,
      } as any),
      sessionService.addMessage(sessionId, {
        role: 'assistant',
        content: assistantText,
        timestamp: now(),
      }),
    ]);
    publishSessionEvent({ sessionId, type: 'ESCALATED', message: assistantText, stage: 6, status: 'ESCALATED', requiresAction: 'EMERGENCY' });
    return { message: assistantText, stage: 6, status: 'ESCALATED', requiresAction: 'EMERGENCY' };
  }

  // ── 7. Compute incremental state updates ─────────────────────────────────
  const newQuestionCount = (session.questionCount ?? 0) + 1;
  const updates: Record<string, any> = { questionCount: newQuestionCount };

  // Capture chief complaint from first user message if not already set
  if (!session.symptomSet?.chiefComplaint) {
    const firstUserMsg = session.messages.find(m => m.role === 'user');
    const complaint = firstUserMsg?.content ?? userMessage;
    updates['symptomSet.chiefComplaint'] = complaint.slice(0, 250);
    updates['symptomSet.redFlagsPresent'] = false;
    updates['symptomSet.language'] = (session.userProfile.language ?? 'EN').toUpperCase();
    updates['symptomSet.symptoms'] = [];
    updates['symptomSet.socrates'] = { associated: [], exacerbating: [], relieving: [] };
    updates['symptomSet.functionalImpact'] = {};
  }

  // Move to differential stage when ready
  const shouldAdvance = analysisReady || newQuestionCount >= 10;
  if (shouldAdvance) {
    updates.stage = 7;
    logger.info('[ConversationLoop] Advancing to Stage 7 (differential)', {
      sessionId,
      questionCount: newQuestionCount,
      trigger: analysisReady ? 'LLM_SIGNAL' : 'MAX_QUESTIONS',
    });
  }

  // ── 8. Persist ────────────────────────────────────────────────────────────
  await Promise.all([
    sessionService.update(sessionId, updates as any),
    sessionService.addMessage(sessionId, {
      role: 'assistant',
      content: assistantText,
      timestamp: now(),
    }),
  ]);

  // ── 9. Publish MESSAGE event ──────────────────────────────────────────────
  if (!shouldAdvance) {
    publishSessionEvent({ sessionId, type: 'MESSAGE', message: assistantText, stage: 5, status: 'IN_PROGRESS', requiresAction: 'NONE' });
  }

  // ── 10. Chain into analysis pipeline when conversation is done ────────────
  if (shouldAdvance) {
    publishSessionEvent({ sessionId, type: 'STAGE_CHANGE', message: assistantText, stage: 7, status: 'IN_PROGRESS', requiresAction: 'ANALYSIS_PENDING' });
    // Re-fetch so analysis pipeline sees updated symptomSet + all messages
    const freshSession = await sessionService.getById(sessionId);
    if (freshSession) {
      return runAnalysisPipeline(freshSession, sessionId);
    }
  }

  return {
    message: assistantText,
    stage: 5,
    status: 'IN_PROGRESS',
    requiresAction: 'NONE',
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Last 4 exchanges (8 messages) converted to Gemini history format. */
function buildRollingWindow(messages: SessionMessage[]): LLMMessage[] {
  return messages.slice(-8).map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    content: m.content,
  }));
}

function buildEmergencyMessage(language?: string, flags?: string[]): string {
  const lang    = (language ?? 'EN').toUpperCase();
  const flagStr = flags?.join(', ') ?? 'serious symptoms';

  if (lang === 'HI') {
    return `आपके लक्षण (${flagStr}) गंभीर हो सकते हैं। कृपया तुरंत नज़दीकी अस्पताल जाएं या 112 पर कॉल करें। यह AI सहायक आपातकालीन देखभाल का विकल्प नहीं है।`;
  }
  if (lang === 'HINGLISH') {
    return `Aapke symptoms (${flagStr}) serious lag rahe hain. Please abhi nearest hospital jaayein ya emergency ke liye 112 pe call karein. Main sirf ek AI hoon — please doctor se milein.`;
  }
  return `Your symptoms (${flagStr}) may require immediate medical attention. Please go to the nearest hospital or call emergency services (112) now. This AI cannot replace emergency care.`;
}

function getWaitMessage(language?: string): string {
  const lang = (language ?? 'EN').toUpperCase();
  if (lang === 'HI')       return 'कृपया एक क्षण प्रतीक्षा करें, मैं आपका मूल्यांकन तैयार कर रहा हूं।';
  if (lang === 'HINGLISH') return 'Ek second ruko — main aapka assessment prepare kar raha hoon.';
  return 'Please hold on a moment while your background assessment is being prepared.';
}

function getRetryMessage(language?: string): string {
  const lang = (language ?? 'EN').toUpperCase();
  if (lang === 'HI')       return 'माफ करें, कुछ तकनीकी समस्या है। क्या आप दोबारा भेज सकते हैं?';
  if (lang === 'HINGLISH') return 'Sorry, thodi technical problem aayi. Kya aap dobara message kar sakte hain?';
  return 'I had a brief technical issue. Could you please repeat your message?';
}

function now(): string {
  return new Date().toISOString();
}
