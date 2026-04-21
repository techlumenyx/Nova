// Stage 4 — Risk fusion
// Merges UserProfile + RegionalRisk + drug flags into a PriorRiskProfile.
// Only uses fields that are actually present — missing fields are skipped.
// This becomes the invisible prior that biases all Stage 5 questions.

import type { IDiagnosisSession, PriorRiskProfile, RegionalRisk } from '../models/session.model';

type UserProfile = IDiagnosisSession['userProfile'];

interface ScoredCondition {
  condition: string;
  score: number;
  reasons: string[];
}

export function buildPriorRiskProfile(
  profile: UserProfile,
  regionalRisk: RegionalRisk,
  drugFlags: string[],
): PriorRiskProfile {
  const scored: ScoredCondition[] = [];
  const demographicFlags: string[] = [];
  const regionFlags: string[] = [];

  // ── Demographic flags ────────────────────────────────────────────────────
  if (profile.age >= 60) demographicFlags.push('Age > 60 — elevated risk for most conditions');
  if (profile.age <= 5)  demographicFlags.push('Age < 5 — severity boosted for fever/respiratory');
  if (profile.bmi && profile.bmi >= 30) demographicFlags.push('BMI ≥ 30 — elevated metabolic and cardiovascular risk');
  if (profile.bmi && profile.bmi < 18.5) demographicFlags.push('BMI < 18.5 — underweight, susceptible to nutritional deficiencies');
  if (profile.sex === 'FEMALE' && profile.age >= 15 && profile.age <= 45) {
    scored.push({ condition: 'UTI', score: 0.2, reasons: ['Female, reproductive age'] });
    scored.push({ condition: 'Iron deficiency anemia', score: 0.15, reasons: ['Female demographic'] });
  }
  if (profile.age >= 40) {
    scored.push({ condition: 'Hypertension', score: 0.15, reasons: ['Age > 40'] });
    scored.push({ condition: 'Type 2 Diabetes', score: 0.12, reasons: ['Age > 40'] });
  }

  // ── Regional flags ───────────────────────────────────────────────────────
  const allRegional = [...(regionalRisk.endemic ?? []), ...(regionalRisk.seasonal ?? [])];
  for (const disease of allRegional) {
    regionFlags.push(`${disease} risk in ${regionalRisk.city}`);
    const existing = scored.find(s => s.condition === disease);
    if (existing) {
      existing.score += 0.25;
      existing.reasons.push(`endemic/seasonal in ${regionalRisk.city}`);
    } else {
      scored.push({
        condition: disease,
        score: 0.25,
        reasons: [`endemic/seasonal in ${regionalRisk.city}`],
      });
    }
  }

  // ── Existing conditions boost (future scope — when health form is built) ─
  for (const condition of profile.conditions ?? []) {
    const lower = condition.toLowerCase();
    if (lower.includes('diabetes')) {
      scored.push({ condition: 'Diabetic complication', score: 0.3, reasons: ['Known diabetic'] });
      scored.push({ condition: 'Skin infection', score: 0.2, reasons: ['Diabetes — impaired immunity'] });
    }
    if (lower.includes('hypertension')) {
      scored.push({ condition: 'Cardiovascular event', score: 0.2, reasons: ['Known hypertension'] });
    }
    if (lower.includes('asthma')) {
      scored.push({ condition: 'Asthma exacerbation', score: 0.35, reasons: ['Known asthma'] });
    }
  }

  // ── Age-based severity boosters ──────────────────────────────────────────
  const ageBump = profile.age >= 60 || profile.age <= 5 ? 0.05 : 0;
  for (const item of scored) item.score += ageBump;

  // ── Build final watchlist (top 7) ────────────────────────────────────────
  const deduped = deduplicateByCondition(scored);
  deduped.sort((a, b) => b.score - a.score);
  const watchlist = deduped.slice(0, 7);

  // ── High risk conditions (shown to agent only) ───────────────────────────
  const highRiskConditions: string[] = [...demographicFlags];
  for (const item of watchlist.filter(w => w.score >= 0.35)) {
    highRiskConditions.push(`Watch for ${item.condition} (score: ${item.score.toFixed(2)})`);
  }

  return {
    highRiskConditions,
    ruledOut: [],
    watchlist,
    drugSymptomFlags: drugFlags,
    demographicFlags,
    regionFlags,
  };
}

function deduplicateByCondition(items: ScoredCondition[]): ScoredCondition[] {
  const map = new Map<string, ScoredCondition>();
  for (const item of items) {
    const existing = map.get(item.condition);
    if (existing) {
      existing.score = Math.max(existing.score, item.score);
      existing.reasons = [...new Set([...existing.reasons, ...item.reasons])];
    } else {
      map.set(item.condition, { ...item });
    }
  }
  return Array.from(map.values());
}
