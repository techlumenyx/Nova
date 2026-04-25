import type { IDiagnosisSession } from '../models/session.model';

/**
 * Builds the system instruction for Gemini based on the current session state.
 * Serialised to ~350 tokens. Updated on every sendMessage call.
 */
export function buildSystemPrompt(session: IDiagnosisSession): string {
  const p    = session.userProfile;
  const lang = (p.language ?? 'EN').toUpperCase();
  const risk = session.priorRiskProfile;
  const sx   = session.symptomSet;

  // ── Language instruction ──────────────────────────────────────────────────
  const langInstr =
    lang === 'HI'       ? 'Respond ONLY in Hindi (Devanagari script).' :
    lang === 'HINGLISH' ? 'Respond in Hinglish (Hindi words in Roman script mixed with English).' :
                          'Respond in clear, simple English at a 7th-grade reading level.';

  // ── Risk context (never shown to patient) ────────────────────────────────
  const riskLines: string[] = [];
  if (risk) {
    if (risk.demographicFlags.length) riskLines.push(`Demographic: ${risk.demographicFlags.join('; ')}`);
    if (risk.regionFlags.length)      riskLines.push(`Region: ${risk.regionFlags.slice(0, 3).join('; ')}`);
    if (risk.drugSymptomFlags.length) riskLines.push(`Drug flags: ${risk.drugSymptomFlags.join('; ')}`);
    if (risk.watchlist.length) {
      const top = risk.watchlist.slice(0, 5).map(w => `${w.condition}(${w.score.toFixed(2)})`).join(', ');
      riskLines.push(`Watchlist: ${top}`);
    }
  }
  const riskBlock = riskLines.length
    ? riskLines.join('\n')
    : 'Risk profile: still loading';

  // ── Symptom state ─────────────────────────────────────────────────────────
  let symptomBlock = 'Chief complaint: not yet collected';
  if (sx) {
    const parts = [`Chief complaint: ${sx.chiefComplaint}`];
    if (sx.symptoms.length) parts.push(`Symptoms: ${sx.symptoms.map(s => s.name).join(', ')}`);
    if (sx.duration)        parts.push(`Duration: ${sx.duration.value} ${sx.duration.unit}`);
    if (sx.socrates.severity != null) parts.push(`Severity: ${sx.socrates.severity}/10`);
    symptomBlock = parts.join('\n');
  }

  const qCount = session.questionCount;

  // ── Previous session context (worsened re-assessment) ────────────────────
  const followUp = session.followUpResponse as any;
  const prevBlock = followUp?.outcome === 'WORSENED'
    ? `\n## Previous Session (WORSENED follow-up)\n` +
      `Last complaint: ${followUp.previousChiefComplaint ?? 'unknown'}\n` +
      `Previous likely condition: ${followUp.previousTopCondition ?? 'unknown'}\n` +
      `Patient reported condition WORSENED at follow-up.\n` +
      `This is a re-assessment — ask fresh SOCRATES questions adapted to the change in status.\n`
    : '';

  // ── Known profile data — drives skip instructions + question budget ────────
  const hasMedications = (p.medications?.length ?? 0) > 0;
  const hasConditions  = (p.conditions?.length  ?? 0) > 0;
  const hasAllergies   = !!(p.allergies?.drugs?.length || p.allergies?.food?.length || p.allergies?.environmental?.length);

  const skipInstructions: string[] = [];
  if (hasMedications) skipInstructions.push('medications (already known from profile — do NOT ask)');
  if (hasConditions)  skipInstructions.push('existing conditions (already known from profile — do NOT ask)');
  if (hasAllergies)   skipInstructions.push('allergies (already known from profile — do NOT ask)');

  const skipBlock = skipInstructions.length
    ? `\nAlready known — skip these questions: ${skipInstructions.join('; ')}.`
    : '';

  // ── Determine what still needs to be asked ────────────────────────────────
  const stillNeeded: string[] = [];
  if (!sx?.chiefComplaint)         stillNeeded.push('chief complaint');
  if (!sx?.socrates.onset)         stillNeeded.push('onset (when did it start, how suddenly)');
  if (!sx?.socrates.character)     stillNeeded.push('character (describe the sensation)');
  if (!sx?.socrates.severity)      stillNeeded.push('severity (1–10 scale)');
  if (!sx?.socrates.associated.length) stillNeeded.push('associated symptoms');
  if (!sx?.socrates.timing)        stillNeeded.push('timing/pattern (constant or intermittent)');
  if (!sx?.functionalImpact.eating && !sx?.functionalImpact.sleeping)
                                   stillNeeded.push('functional impact (eating/sleeping/work affected)');
  if (!hasMedications && !sx?.medicationTaken)
                                   stillNeeded.push('medications taken for this symptom');

  const nextAsk = stillNeeded.length
    ? `Next missing info: ${stillNeeded.slice(0, 2).join(', ')}.`
    : 'All key SOCRATES dimensions covered.';

  return `You are Nova, a medical triage assistant serving patients in India.
${langInstr}
${prevBlock}
## Patient
Age: ${p.age} | Sex: ${p.sex} | City: ${p.city ?? 'Unknown'} | Month: ${currentMonth()}
Conditions: ${hasConditions  ? p.conditions!.join(', ')                       : 'none reported'}
Medications: ${hasMedications ? p.medications!.map(m => `${m.name} ${m.dosage}`).join(', ') : 'none'}
Allergies:   ${hasAllergies   ? [
    ...(p.allergies!.drugs?.length         ? [`drugs: ${p.allergies!.drugs.join(', ')}`]         : []),
    ...(p.allergies!.food?.length          ? [`food: ${p.allergies!.food.join(', ')}`]          : []),
    ...(p.allergies!.environmental?.length ? [`env: ${p.allergies!.environmental.join(', ')}`] : []),
  ].join('; ')                             : 'none reported'}${skipBlock}

## Clinical Context (CONFIDENTIAL — do NOT share with patient)
${riskBlock}

## Current Symptom State
${symptomBlock}
Questions asked: ${qCount}/10
${nextAsk}

## Conversation Rules
1. Ask EXACTLY ONE focused question per message. Never ask two questions in the same reply.
2. Follow SOCRATES order but adapt naturally — if patient volunteers info, skip that dimension.
3. If ${10 - qCount} or fewer questions remain, wrap up efficiently.
4. When you have enough information (question count reaches 10, OR all key dimensions covered), end your reply with the EXACT token: [ANALYSIS_READY]
5. Do NOT include [ANALYSIS_READY] before sufficient information is gathered.

## Safety Rules (ABSOLUTE — never violate)
- If the patient mentions chest pain, difficulty breathing, very high fever (>104°F/40.5°C), loss of consciousness, seizure, stroke symptoms, or suicidal thoughts: respond with IMMEDIATE emergency guidance and end your reply with [EMERGENCY_ESCALATE].
- Never diagnose definitively. Use "this could be" or "this might suggest" — not "you have".
- Never prescribe or recommend specific prescription drugs.
- Always encourage seeing a qualified doctor for anything beyond mild self-care.
- Never claim to be a human or a licensed physician.
- Disclaimer: You are an AI assistant, not a doctor.`;
}

function currentMonth(): string {
  return new Date().toLocaleString('default', { month: 'long' });
}
