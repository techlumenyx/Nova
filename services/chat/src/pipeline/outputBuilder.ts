/**
 * Stage 10 — Structured Output Builder
 *
 * Assembles all pipeline results into a DiagnosisOutput document
 * and formats it as a readable text message for the chat UI.
 */

import type {
  IDiagnosisSession,
  DiagnosisOutput,
  DifferentialResult,
  RemedyResult,
  LabTestRecommendation,
} from '../models/session.model';

// ─── Severity + action mapping ────────────────────────────────────────────────

const SEVERE_CONDITIONS = new Set([
  'appendicitis', 'pneumonia', 'sepsis', 'meningitis', 'pulmonary embolism',
  'heart attack', 'myocardial infarction', 'stroke', 'encephalitis',
  'malaria', 'leptospirosis', 'dengue haemorrhagic fever',
]);

export function deriveSeverity(
  diff: DifferentialResult,
  redFlagTriggered: boolean,
): 'LOW' | 'MODERATE' | 'HIGH' | 'EMERGENCY' {
  if (redFlagTriggered) return 'EMERGENCY';
  if (diff.flag === 'SEVERE') {
    const top = diff.probableCauses[0];
    if (
      top?.confidence >= 0.6 &&
      SEVERE_CONDITIONS.has(top.condition.toLowerCase())
    ) return 'EMERGENCY';
    return 'HIGH';
  }
  const topConf = diff.probableCauses[0]?.confidence ?? 0;
  if (topConf >= 0.65) return 'MODERATE';
  return 'LOW';
}

export function deriveAction(
  severity: 'LOW' | 'MODERATE' | 'HIGH' | 'EMERGENCY',
): 'SELF_CARE' | 'MONITOR' | 'VISIT_DOCTOR' | 'ER_NOW' {
  if (severity === 'EMERGENCY') return 'ER_NOW';
  if (severity === 'HIGH')      return 'VISIT_DOCTOR';
  if (severity === 'MODERATE')  return 'VISIT_DOCTOR';
  return 'SELF_CARE';
}

const WATCH_FOR_MAP: Record<string, string[]> = {
  'Dengue fever':       ['Platelet fall below 100,000', 'Spontaneous bleeding or rash', 'Severe abdominal pain'],
  'Malaria':            ['High cyclical fever with chills', 'Altered consciousness', 'Jaundice or dark urine'],
  'Typhoid':            ['Fever persisting beyond 7 days', 'Abdominal bloating/tenderness', 'Rose spots on trunk'],
  'Pneumonia':          ['Breathing rate > 30/min', 'SpO2 < 94 %', 'Confusion or drowsiness'],
  'Leptospirosis':      ['Yellow eyes/skin (jaundice)', 'Decreased urine output', 'Bleeding from gums or skin'],
  'Appendicitis':       ['Pain moving to lower right abdomen', 'Rigid/board-like abdomen', 'Fever with vomiting'],
  'UTI':                ['Fever with chills (kidney involvement)', 'Back/flank pain', 'Blood in urine'],
  'Gastroenteritis':    ['No urine for 8+ hours (dehydration)', 'Blood in stool', 'Severe cramping'],
};

function getWatchFor(diff: DifferentialResult): string[] {
  const watches: string[] = [];
  const seen = new Set<string>();
  for (const cause of diff.probableCauses.slice(0, 3)) {
    const lower = cause.condition.toLowerCase();
    const key = Object.keys(WATCH_FOR_MAP).find(k => lower.includes(k.toLowerCase()));
    if (key) {
      for (const w of WATCH_FOR_MAP[key]) {
        if (!seen.has(w)) { seen.add(w); watches.push(w); }
      }
    }
  }
  if (!watches.length) {
    watches.push('Symptoms worsening or new symptoms appearing', 'Fever above 103°F / 39.4°C');
  }
  return watches.slice(0, 5);
}

// ─── Build DiagnosisOutput object ────────────────────────────────────────────

export function buildOutput(
  session: IDiagnosisSession,
  diff: DifferentialResult,
  remedies: RemedyResult[],
  labTests: LabTestRecommendation[],
): DiagnosisOutput {
  const severity   = deriveSeverity(diff, session.redFlagTriggered);
  const action     = deriveAction(severity);
  const lang       = (session.userProfile.language ?? 'EN').toUpperCase() as 'EN' | 'HI' | 'HINGLISH';
  const watchFor   = getWatchFor(diff);
  const actionDetail = buildActionDetail(action, severity, lang);

  return {
    severity,
    probableCauses: diff.probableCauses.map(c => ({
      condition:   c.condition,
      confidence:  c.confidence,
      explanation: c.reasons.join('. '),
    })),
    ruledOut:            diff.ruledOut,
    action,
    actionDetail,
    homeRemedies:        remedies,
    labTestsRecommended: labTests,
    watchFor,
    disclaimer:          buildDisclaimer(lang),
    emergencyNumber:     severity === 'EMERGENCY' ? '112' : undefined,
    language:            lang,
  };
}

function buildActionDetail(
  action: 'SELF_CARE' | 'MONITOR' | 'VISIT_DOCTOR' | 'ER_NOW',
  severity: 'LOW' | 'MODERATE' | 'HIGH' | 'EMERGENCY',
  lang: 'EN' | 'HI' | 'HINGLISH',
): string {
  if (lang === 'HI') {
    if (action === 'ER_NOW')        return 'तुरंत नज़दीकी अस्पताल जाएं या 112 पर कॉल करें।';
    if (action === 'VISIT_DOCTOR')  return 'जल्द से जल्द (24–48 घंटे में) किसी डॉक्टर से मिलें।';
    if (action === 'MONITOR')       return 'घर पर आराम करें और लक्षणों पर नज़र रखें। यदि बिगड़े तो डॉक्टर से मिलें।';
    return 'घरेलू उपचार से देखभाल करें। यदि सुधार नहीं हो तो डॉक्टर से मिलें।';
  }
  if (lang === 'HINGLISH') {
    if (action === 'ER_NOW')        return 'Abhi nearest hospital jaayein ya 112 pe call karein.';
    if (action === 'VISIT_DOCTOR')  return 'Jaldi se (24–48 ghante mein) doctor se milein.';
    if (action === 'MONITOR')       return 'Ghar pe aaram karein aur symptoms dekhte rahein. Bure hone pe doctor ke paas jaayein.';
    return 'Ghar pe care karein. Agar 2–3 din mein theek na ho, doctor se milein.';
  }
  if (action === 'ER_NOW')        return 'Go to the nearest emergency room or call 112 immediately.';
  if (action === 'VISIT_DOCTOR')  return 'See a doctor within 24–48 hours.';
  if (action === 'MONITOR')       return 'Rest at home and monitor your symptoms. See a doctor if they worsen.';
  return 'Home care is appropriate. If no improvement in 2–3 days, consult a doctor.';
}

function buildDisclaimer(lang: 'EN' | 'HI' | 'HINGLISH'): string {
  if (lang === 'HI')       return 'यह AI-आधारित जानकारी है, चिकित्सा निदान नहीं। कृपया योग्य डॉक्टर से परामर्श लें।';
  if (lang === 'HINGLISH') return 'Yeh AI information hai, medical diagnosis nahi. Qualified doctor se zaroor milein.';
  return 'This is AI-generated information, not a medical diagnosis. Always consult a qualified doctor.';
}

// ─── Format DiagnosisOutput as readable chat message ─────────────────────────

export function formatOutputMessage(output: DiagnosisOutput): string {
  const lang = output.language;

  if (lang === 'HI') return formatHindi(output);
  if (lang === 'HINGLISH') return formatHinglish(output);
  return formatEnglish(output);
}

function formatEnglish(out: DiagnosisOutput): string {
  const lines: string[] = [];

  lines.push('Based on everything you have shared, here is my assessment:\n');

  // Probable causes
  const top = out.probableCauses[0];
  if (top) {
    lines.push(`**Most likely: ${top.condition}** (${pct(top.confidence)} likelihood)`);
    lines.push(`Reasons: ${top.explanation}`);
  }
  if (out.probableCauses.length > 1) {
    const others = out.probableCauses.slice(1).map(c => c.condition).join(', ');
    lines.push(`Other possibilities: ${others}\n`);
  }

  // Action
  const sev = severityLabel(out.severity, 'EN');
  lines.push(`**Severity: ${sev}**`);
  lines.push(`${out.actionDetail}\n`);

  // Emergency number
  if (out.emergencyNumber) {
    lines.push(`🚨 Emergency: ${out.emergencyNumber}\n`);
  }

  // Home remedies
  if (out.homeRemedies.length) {
    lines.push('**Home remedies you can try:**');
    for (const r of out.homeRemedies) {
      lines.push(`• **${r.nameEn}**: ${r.preparationEn}`);
    }
    lines.push('');
  }

  // Lab tests
  if (out.labTestsRecommended.length) {
    lines.push('**Recommended tests:**');
    for (const t of out.labTestsRecommended) {
      lines.push(`• ${t.testName} — ${t.reason} (${t.urgency.toLowerCase()})`);
    }
    lines.push('');
  }

  // Watch for
  if (out.watchFor.length) {
    lines.push('**Watch for these warning signs (go to doctor immediately if):**');
    for (const w of out.watchFor) lines.push(`• ${w}`);
    lines.push('');
  }

  lines.push(`_${out.disclaimer}_`);

  return lines.join('\n');
}

function formatHindi(out: DiagnosisOutput): string {
  const lines: string[] = [];
  lines.push('आपके बताए लक्षणों के आधार पर मेरा आकलन:\n');

  const top = out.probableCauses[0];
  if (top) {
    lines.push(`**सबसे संभावित: ${top.condition}** (${pct(top.confidence)} संभावना)`);
    lines.push(`कारण: ${top.explanation}`);
  }
  if (out.probableCauses.length > 1) {
    lines.push(`अन्य संभावनाएं: ${out.probableCauses.slice(1).map(c => c.condition).join(', ')}\n`);
  }

  lines.push(`**गंभीरता: ${severityLabel(out.severity, 'HI')}**`);
  lines.push(`${out.actionDetail}\n`);

  if (out.emergencyNumber) lines.push(`🚨 आपातकाल: ${out.emergencyNumber}\n`);

  if (out.homeRemedies.length) {
    lines.push('**घरेलू उपचार:**');
    for (const r of out.homeRemedies) lines.push(`• **${r.nameHi}**: ${r.preparationHi}`);
    lines.push('');
  }

  if (out.labTestsRecommended.length) {
    lines.push('**अनुशंसित जाँचें:**');
    for (const t of out.labTestsRecommended) lines.push(`• ${t.testName} — ${t.reason}`);
    lines.push('');
  }

  if (out.watchFor.length) {
    lines.push('**इन लक्षणों पर ध्यान दें:**');
    for (const w of out.watchFor) lines.push(`• ${w}`);
    lines.push('');
  }

  lines.push(`_${out.disclaimer}_`);
  return lines.join('\n');
}

function formatHinglish(out: DiagnosisOutput): string {
  const lines: string[] = [];
  lines.push('Aapke symptoms ke basis pe mera assessment:\n');

  const top = out.probableCauses[0];
  if (top) {
    lines.push(`**Sabse zyada sambhav: ${top.condition}** (${pct(top.confidence)} likelihood)`);
    lines.push(`Reasons: ${top.explanation}`);
  }
  if (out.probableCauses.length > 1) {
    lines.push(`Other possibilities: ${out.probableCauses.slice(1).map(c => c.condition).join(', ')}\n`);
  }

  lines.push(`**Severity: ${severityLabel(out.severity, 'HINGLISH')}**`);
  lines.push(`${out.actionDetail}\n`);

  if (out.emergencyNumber) lines.push(`🚨 Emergency: ${out.emergencyNumber}\n`);

  if (out.homeRemedies.length) {
    lines.push('**Ghar pe try kar sakte hain:**');
    for (const r of out.homeRemedies) lines.push(`• **${r.nameEn}**: ${r.preparationEn}`);
    lines.push('');
  }

  if (out.labTestsRecommended.length) {
    lines.push('**Recommended tests:**');
    for (const t of out.labTestsRecommended) lines.push(`• ${t.testName} — ${t.reason}`);
    lines.push('');
  }

  if (out.watchFor.length) {
    lines.push('**In signs ko dhyaan se dekhein:**');
    for (const w of out.watchFor) lines.push(`• ${w}`);
    lines.push('');
  }

  lines.push(`_${out.disclaimer}_`);
  return lines.join('\n');
}

function pct(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

function severityLabel(s: 'LOW' | 'MODERATE' | 'HIGH' | 'EMERGENCY', lang: string): string {
  const map: Record<string, Record<string, string>> = {
    EN:       { LOW: 'Low',     MODERATE: 'Moderate',    HIGH: 'High',   EMERGENCY: 'Emergency' },
    HI:       { LOW: 'सामान्य', MODERATE: 'मध्यम',       HIGH: 'गंभीर',  EMERGENCY: 'आपातकाल'  },
    HINGLISH: { LOW: 'Low',     MODERATE: 'Moderate',    HIGH: 'High',   EMERGENCY: 'Emergency' },
  };
  return map[lang]?.[s] ?? s;
}
