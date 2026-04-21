/**
 * Stage 7 — Differential Diagnosis
 * Calls Gemini with full symptom context, requests structured JSON.
 * Falls back to a safe generic result if LLM fails or returns bad JSON.
 */

import { callLLMJson } from './llm';
import { logger } from '@nova/shared';
import type { IDiagnosisSession, DifferentialResult } from '../models/session.model';

const SYSTEM = `You are a clinical decision-support AI. You analyse patient data and produce a differential diagnosis.
Output ONLY a valid JSON object — no markdown, no prose before or after.`;

interface RawDiff {
  probableCauses: { condition: string; confidence: number; reasons: string[] }[];
  ruledOut: { condition: string; reason: string }[];
  flag: 'GENERIC' | 'SEVERE';
}

export async function runDifferential(session: IDiagnosisSession): Promise<DifferentialResult> {
  const prompt = buildPrompt(session);

  const raw = await callLLMJson<RawDiff>(SYSTEM, [], prompt);

  if (!raw?.probableCauses?.length) {
    logger.warn('[Differential] LLM returned invalid result, using fallback', {
      sessionId: session._id,
    });
    return fallback();
  }

  return {
    probableCauses: raw.probableCauses.map(c => ({
      condition: c.condition,
      confidence: clamp(c.confidence, 0, 1),
      reasons: c.reasons ?? [],
    })),
    ruledOut: raw.ruledOut ?? [],
    flag: raw.flag === 'SEVERE' ? 'SEVERE' : 'GENERIC',
    generatedAt: new Date().toISOString(),
  };
}

// ─── Private ────────────────────────────────────────────────────────────────

function buildPrompt(session: IDiagnosisSession): string {
  const p    = session.userProfile;
  const sx   = session.symptomSet;
  const risk = session.priorRiskProfile;

  const lines: string[] = [
    `Patient: ${p.age}y ${p.sex}, ${p.city ?? 'India'}, ${monthName()}`,
    `Known conditions: ${p.conditions?.join(', ') || 'none'}`,
    `Medications: ${p.medications?.map(m => m.name).join(', ') || 'none'}`,
  ];

  if (sx) {
    lines.push(`Chief complaint: ${sx.chiefComplaint}`);
    // NOTE: symptomSet.symptoms is populated by the LLM conversation —
    // if empty, fall through to the full conversation transcript below.
    if (sx.symptoms?.length)
      lines.push(`Extracted symptoms: ${sx.symptoms.map(s => s.name).join(', ')}`);
    if (sx.duration)
      lines.push(`Duration: ${sx.duration.value} ${sx.duration.unit}`);
    if (sx.socrates) {
      const s = sx.socrates;
      if (s.onset)                    lines.push(`Onset: ${s.onset}`);
      if (s.character)                lines.push(`Character: ${s.character}`);
      if (s.severity != null)         lines.push(`Severity: ${s.severity}/10`);
      if (s.associated?.length)       lines.push(`Associated: ${s.associated.join(', ')}`);
      if (s.radiation)                lines.push(`Radiation: ${s.radiation}`);
      if (s.timing)                   lines.push(`Pattern: ${s.timing}`);
      if (s.exacerbating?.length)     lines.push(`Worsened by: ${s.exacerbating.join(', ')}`);
      if (s.relieving?.length)        lines.push(`Relieved by: ${s.relieving.join(', ')}`);
    }
    if (sx.pattern)                   lines.push(`Overall pattern: ${sx.pattern}`);
    const fi = sx.functionalImpact;
    if (fi) {
      const impacts = Object.entries(fi)
        .filter(([, v]) => v)
        .map(([k]) => k);
      if (impacts.length) lines.push(`Functional impact: ${impacts.join(', ')}`);
    }
    if (sx.medicationTaken)           lines.push(`Self-medication taken: ${sx.medicationTaken}`);
  }

  if (risk) {
    if (risk.regionFlags?.length)
      lines.push(`Regional risk: ${risk.regionFlags.slice(0, 3).join('; ')}`);
    if (risk.demographicFlags?.length)
      lines.push(`Demographic flags: ${risk.demographicFlags.join('; ')}`);
    if (risk.drugSymptomFlags?.length)
      lines.push(`Drug-symptom flags: ${risk.drugSymptomFlags.join('; ')}`);
    if (risk.watchlist?.length) {
      const top = risk.watchlist.slice(0, 5)
        .map(w => `${w.condition}(prior=${w.score.toFixed(2)})`)
        .join(', ');
      lines.push(`Prior probability watchlist: ${top}`);
    }
  }

  // Append full conversation transcript — this is the primary symptom source
  // since per-turn structured extraction is Phase 2.
  const convo = session.messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => `${m.role === 'user' ? 'Patient' : 'Nova'}: ${m.content}`)
    .join('\n');
  if (convo) {
    lines.push('\n--- Full symptom interview ---');
    lines.push(convo);
    lines.push('--- End of interview ---');
  }

  return `${lines.join('\n')}

Return a JSON object with exactly this structure:
{
  "probableCauses": [
    { "condition": "string", "confidence": 0.0–1.0, "reasons": ["string", ...] }
  ],
  "ruledOut": [
    { "condition": "string", "reason": "string" }
  ],
  "flag": "GENERIC" or "SEVERE"
}

Constraints:
- List 2–5 probable causes, sorted by confidence descending.
- Set flag "SEVERE" if top cause is potentially dangerous or requires urgent evaluation.
- Include up to 3 ruled-out conditions.
- Never say "you have X" — these are probabilities only.`;
}

function fallback(): DifferentialResult {
  return {
    probableCauses: [{
      condition: 'Undetermined',
      confidence: 0.5,
      reasons: ['Symptom pattern inconclusive — please consult a doctor'],
    }],
    ruledOut: [],
    flag: 'GENERIC',
    generatedAt: new Date().toISOString(),
  };
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function monthName(): string {
  return new Date().toLocaleString('default', { month: 'long' });
}
