/**
 * Stage 8 — Lab Test Mapping
 * Maps probable conditions from differential → LabTestRecommendation[].
 * Static in Phase 1. Content service integration is Phase 2.
 */

import type { DifferentialResult, LabTestRecommendation } from '../models/session.model';

// ─── Static condition → test map ─────────────────────────────────────────────

const LAB_MAP: Record<string, LabTestRecommendation[]> = {
  'Dengue fever': [
    { testName: 'NS1 Antigen Test',      slug: 'dengue-ns1',      reason: 'Early dengue detection (days 1–5)',        urgency: 'SOON'    },
    { testName: 'Complete Blood Count',  slug: 'cbc',             reason: 'Monitor platelet fall',                   urgency: 'SOON'    },
    { testName: 'Dengue IgM/IgG ELISA',  slug: 'dengue-elisa',    reason: 'Confirm dengue after day 5',              urgency: 'ROUTINE' },
  ],
  'Malaria': [
    { testName: 'Rapid Diagnostic Test (RDT)', slug: 'malaria-rdt',   reason: 'Quick bedside malaria screening',     urgency: 'URGENT'  },
    { testName: 'Peripheral Blood Smear',      slug: 'malaria-smear', reason: 'Identify malaria species',            urgency: 'URGENT'  },
  ],
  'Typhoid': [
    { testName: 'Widal Test',            slug: 'widal',           reason: 'Typhoid antibody detection',              urgency: 'SOON'    },
    { testName: 'Blood Culture',         slug: 'blood-culture',   reason: 'Definitive diagnosis + antibiotic guide', urgency: 'SOON'    },
  ],
  'Leptospirosis': [
    { testName: 'Leptospira IgM ELISA',  slug: 'lepto-igm',       reason: 'Confirm leptospirosis',                   urgency: 'URGENT'  },
    { testName: 'Kidney Function Test',  slug: 'kft',             reason: 'Assess renal involvement',                urgency: 'SOON'    },
    { testName: 'Liver Function Test',   slug: 'lft',             reason: 'Assess liver involvement',                urgency: 'SOON'    },
  ],
  'UTI': [
    { testName: 'Urine Routine & Microscopy', slug: 'urine-routine', reason: 'Detect pus cells and bacteria',        urgency: 'ROUTINE' },
    { testName: 'Urine Culture & Sensitivity',slug: 'urine-culture', reason: 'Identify bacteria + guide antibiotic', urgency: 'ROUTINE' },
  ],
  'Iron deficiency anemia': [
    { testName: 'Complete Blood Count',  slug: 'cbc',             reason: 'Haemoglobin levels',                      urgency: 'ROUTINE' },
    { testName: 'Serum Ferritin',        slug: 'ferritin',        reason: 'Iron stores assessment',                  urgency: 'ROUTINE' },
  ],
  'Anaemia': [
    { testName: 'Complete Blood Count',  slug: 'cbc',             reason: 'Haemoglobin and RBC indices',             urgency: 'ROUTINE' },
  ],
  'Type 2 Diabetes': [
    { testName: 'Fasting Blood Glucose', slug: 'fbg',             reason: 'Diabetes screening',                      urgency: 'ROUTINE' },
    { testName: 'HbA1c',                 slug: 'hba1c',           reason: 'Long-term glucose control',               urgency: 'ROUTINE' },
  ],
  'Hypertension': [
    { testName: 'Kidney Function Test',  slug: 'kft',             reason: 'Check hypertensive nephropathy',          urgency: 'ROUTINE' },
    { testName: 'Lipid Profile',         slug: 'lipid-profile',   reason: 'Cardiovascular risk',                     urgency: 'ROUTINE' },
    { testName: 'ECG',                   slug: 'ecg',             reason: 'Cardiac involvement screening',           urgency: 'ROUTINE' },
  ],
  'Thyroid disorder': [
    { testName: 'TSH',                   slug: 'tsh',             reason: 'Primary thyroid function',                urgency: 'ROUTINE' },
    { testName: 'Free T3 / Free T4',     slug: 't3-t4',           reason: 'Complete thyroid panel',                  urgency: 'ROUTINE' },
  ],
  'Hepatitis': [
    { testName: 'Liver Function Test',   slug: 'lft',             reason: 'Liver enzyme levels',                     urgency: 'SOON'    },
    { testName: 'HBsAg',                 slug: 'hbsag',           reason: 'Hepatitis B screening',                   urgency: 'SOON'    },
    { testName: 'Anti-HCV',              slug: 'anti-hcv',        reason: 'Hepatitis C screening',                   urgency: 'SOON'    },
  ],
  'Pneumonia': [
    { testName: 'Chest X-Ray',           slug: 'chest-xray',      reason: 'Visualise lung consolidation',            urgency: 'URGENT'  },
    { testName: 'Complete Blood Count',  slug: 'cbc',             reason: 'Assess infection severity',               urgency: 'SOON'    },
    { testName: 'CRP',                   slug: 'crp',             reason: 'Inflammation marker',                     urgency: 'SOON'    },
  ],
  'COVID-19': [
    { testName: 'RT-PCR (COVID-19)',     slug: 'covid-rtpcr',     reason: 'Confirm SARS-CoV-2 infection',            urgency: 'SOON'    },
    { testName: 'SpO2 monitoring',       slug: 'spo2',            reason: 'Oxygen saturation tracking',              urgency: 'SOON'    },
  ],
  'Gastroenteritis': [
    { testName: 'Stool Routine & Microscopy', slug: 'stool-routine', reason: 'Identify pathogen type',              urgency: 'ROUTINE' },
  ],
  'Appendicitis': [
    { testName: 'Complete Blood Count',  slug: 'cbc',             reason: 'Elevated WBC suggests infection',         urgency: 'URGENT'  },
    { testName: 'Ultrasound Abdomen',    slug: 'usg-abdomen',     reason: 'Visualise appendix',                      urgency: 'URGENT'  },
  ],
  'Kidney stones': [
    { testName: 'Urine Routine',         slug: 'urine-routine',   reason: 'Detect blood in urine',                   urgency: 'SOON'    },
    { testName: 'Ultrasound KUB',        slug: 'usg-kub',         reason: 'Detect stone size and location',          urgency: 'SOON'    },
  ],
  'Chikungunya': [
    { testName: 'Chikungunya IgM ELISA', slug: 'chik-igm',        reason: 'Confirm chikungunya infection',           urgency: 'SOON'    },
    { testName: 'Complete Blood Count',  slug: 'cbc',             reason: 'Rule out dengue co-infection',            urgency: 'ROUTINE' },
  ],
};

// Fuzzy match key — handles "Dengue" matching "Dengue fever", etc.
function findKey(condition: string): string | undefined {
  const lower = condition.toLowerCase();
  return Object.keys(LAB_MAP).find(k => {
    const kl = k.toLowerCase();
    return kl === lower || lower.includes(kl) || kl.includes(lower.split(' ')[0]);
  });
}

/**
 * Returns de-duplicated lab tests for the top probable conditions.
 * Only recommends tests when severity is MODERATE or above.
 */
export function mapLabTests(
  differential: DifferentialResult,
  severity: 'LOW' | 'MODERATE' | 'HIGH' | 'EMERGENCY',
): LabTestRecommendation[] {
  if (severity === 'LOW') return [];

  const seen = new Set<string>();
  const results: LabTestRecommendation[] = [];

  for (const cause of differential.probableCauses.slice(0, 3)) {
    const key = findKey(cause.condition);
    if (!key) continue;
    for (const test of LAB_MAP[key]) {
      if (!seen.has(test.slug)) {
        seen.add(test.slug);
        results.push(test);
      }
    }
  }

  return results.slice(0, 6); // cap at 6 tests
}
