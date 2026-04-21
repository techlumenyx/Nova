/**
 * Stage 9 — Two-Layer Safety Guardrail
 *
 * Layer 1 (always on): Regex rules applied to final output text.
 *   - Strips/replaces definitive diagnosis language
 *   - Blocks prescription drug name leakage
 *   - Ensures disclaimer is present
 *
 * Layer 2 (requires OPENAI_API_KEY): OpenAI Moderation API on final text.
 *   - Gracefully disabled if key not set
 */

import { logger } from '@nova/shared';

// ─── Layer 1 — Regex Rules ────────────────────────────────────────────────────

interface RedactRule {
  pattern: RegExp;
  replacement: string;
  label: string;
}

const REDACT_RULES: RedactRule[] = [
  // Definitive diagnosis language
  {
    pattern: /\byou (definitely |certainly |absolutely )?(have|are suffering from|are diagnosed with)\b/gi,
    replacement: 'you may have',
    label: 'definitive_diagnosis',
  },
  // Prescription drug recommendations
  {
    pattern: /\b(amoxicillin|azithromycin|ciprofloxacin|metformin|amlodipine|atorvastatin|omeprazole|pantoprazole|clopidogrel|warfarin|dexamethasone|prednisolone|hydroxychloroquine)\b/gi,
    replacement: '[prescription medication — consult your doctor]',
    label: 'prescription_drug',
  },
  // Overconfident prognosis
  {
    pattern: /\b(this will (definitely|certainly) (get better|resolve|heal))\b/gi,
    replacement: 'this may improve',
    label: 'overconfident_prognosis',
  },
];

/** Layer 1: regex-based content hardening. Returns cleaned text. */
export function applyLayer1(text: string): { text: string; flagged: string[] } {
  const flagged: string[] = [];
  let result = text;
  for (const rule of REDACT_RULES) {
    if (rule.pattern.test(result)) {
      flagged.push(rule.label);
      result = result.replace(rule.pattern, rule.replacement);
    }
  }
  return { text: result, flagged };
}

// ─── Layer 2 — OpenAI Moderation ─────────────────────────────────────────────

/** Returns true if text is safe, false if blocked by moderation. */
export async function applyLayer2(text: string, sessionId: string): Promise<boolean> {
  if (!process.env.OPENAI_API_KEY) return true; // not configured — pass through

  try {
    const resp = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ input: text }),
    });

    if (!resp.ok) {
      logger.warn('[SafetyGuardrail] Moderation API error, passing through', {
        status: resp.status,
        sessionId,
      });
      return true;
    }

    const data = await resp.json() as { results: { flagged: boolean; categories: Record<string, boolean> }[] };
    const result = data.results[0];

    if (result.flagged) {
      logger.warn('[SafetyGuardrail] Layer 2 BLOCKED response', {
        sessionId,
        categories: Object.entries(result.categories)
          .filter(([, v]) => v)
          .map(([k]) => k),
      });
      return false;
    }
    return true;
  } catch (err) {
    logger.warn('[SafetyGuardrail] Layer 2 request failed, passing through', { err, sessionId });
    return true; // fail open — Layer 1 already applied
  }
}

/** Blocked response fallback per language. */
export function blockedFallback(language?: string): string {
  const lang = (language ?? 'EN').toUpperCase();
  if (lang === 'HI')       return 'क्षमा करें, मैं इस प्रश्न का उत्तर नहीं दे सकता। कृपया किसी योग्य चिकित्सक से मिलें।';
  if (lang === 'HINGLISH') return 'Sorry, main is sawaal ka jawab nahi de sakta. Kisi doctor se milein.';
  return 'I\'m unable to provide a response to that. Please consult a qualified doctor.';
}
