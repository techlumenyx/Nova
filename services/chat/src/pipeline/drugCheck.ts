// Stage 3 — Drug interaction hard check
// Maps medication names to symptoms they commonly cause.
// When a match is found, it's flagged in PriorRiskProfile so the
// agent asks about it early and surfaces it in output if relevant.

const DRUG_SYMPTOM_MAP: { drugs: string[]; symptoms: string[] }[] = [
  { drugs: ['metformin'],                           symptoms: ['nausea', 'diarrhea', 'stomach upset', 'GI discomfort'] },
  { drugs: ['lisinopril', 'enalapril', 'ramipril', 'ace inhibitor'], symptoms: ['dry cough', 'persistent cough'] },
  { drugs: ['atorvastatin', 'rosuvastatin', 'statin'], symptoms: ['muscle pain', 'muscle weakness', 'fatigue'] },
  { drugs: ['fluoxetine', 'sertraline', 'escitalopram', 'ssri'],     symptoms: ['insomnia', 'nausea', 'headache', 'anxiety'] },
  { drugs: ['cetirizine', 'loratadine', 'antihistamine'],            symptoms: ['drowsiness', 'dry mouth', 'fatigue'] },
  { drugs: ['propranolol', 'atenolol', 'metoprolol', 'beta blocker'], symptoms: ['fatigue', 'cold hands', 'dizziness'] },
  { drugs: ['ibuprofen', 'naproxen', 'nsaid'],                       symptoms: ['stomach pain', 'nausea', 'GI bleed risk'] },
  { drugs: ['aspirin'],                                              symptoms: ['stomach irritation', 'nausea', 'ringing in ears'] },
  { drugs: ['amlodipine', 'calcium channel blocker'],                symptoms: ['ankle swelling', 'headache', 'flushing'] },
  { drugs: ['levothyroxine', 'thyroid'],                             symptoms: ['palpitations', 'insomnia', 'weight changes'] },
];

export function checkDrugInteractions(
  medications: { name: string; dosage: string }[],
): string[] {
  const flags: string[] = [];

  for (const med of medications) {
    const name = med.name.toLowerCase();
    for (const entry of DRUG_SYMPTOM_MAP) {
      const matched = entry.drugs.some(d => name.includes(d));
      if (matched) {
        flags.push(`${med.name} can cause: ${entry.symptoms.join(', ')}`);
        break;
      }
    }
  }

  return flags;
}
