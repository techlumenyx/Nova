/** Passive red-flag patterns — scanned on EVERY user message (Stage 5+). */

interface RedFlagRule {
  pattern: RegExp;
  label: string;
}

const RULES: RedFlagRule[] = [
  // Cardiovascular
  { pattern: /chest\s*(pain|tightness|pressure|heaviness)/i,        label: 'Chest pain/pressure' },
  { pattern: /heart\s*(attack|racing|palpitation)/i,                label: 'Heart symptoms' },

  // Respiratory
  { pattern: /can['']?t\s*(breathe|breathing)|unable\s*to\s*breathe/i, label: 'Unable to breathe' },
  { pattern: /shortness\s*of\s*breath|short\s*of\s*breath/i,        label: 'Shortness of breath' },
  { pattern: /saans\s*(nahi|band|nhi|lene\s*mein)|saans\s*nahi\s*aa/i, label: 'Breathing difficulty (Hindi)' },

  // Neurological
  { pattern: /unconscious|unresponsive|fainted|fainting|passed\s*out/i, label: 'Loss of consciousness' },
  { pattern: /stroke|paralys(is|ed|ed)|face\s*(drooping|numb)/i,    label: 'Stroke symptoms' },
  { pattern: /worst\s*headache|sudden\s*(severe|bad)\s*headache|thunderclap/i, label: 'Thunderclap headache' },
  { pattern: /seizure|convuls(ion|ing)|fits|epilepsy\s*attack/i,    label: 'Seizure/convulsion' },

  // Bleeding / Fluids
  { pattern: /blood\s*in\s*(stool|urine|pee|poop|vomit|cough)/i,   label: 'Blood in secretions' },
  { pattern: /vomit(ing)?\s*blood|cough(ing)?\s*blood|black\s*stool/i, label: 'GI bleed signs' },
  { pattern: /khoon\s*(aa\s*raha|tha)/i,                            label: 'Bleeding (Hindi)' },

  // Severe fever
  { pattern: /1(04|05|06|07)\s*(degree|°|f\b)|40\.[5-9]|41\s*(degree|°|celsius)/i, label: 'Dangerously high fever' },

  // Mental health / safety
  { pattern: /suicid|self[\s-]harm|kill\s*(myself|me|oneself)/i,    label: 'Self-harm ideation' },
  { pattern: /want\s*to\s*die|end\s*(my|this)\s*life/i,             label: 'Suicidal ideation' },

  // Poisoning
  { pattern: /poison(ed|ing)?|overdose|swallowed\s*(too\s*much|wrong)/i, label: 'Poisoning/overdose' },

  // Pediatric red flags
  { pattern: /baby\s*(not\s*breathing|turning\s*blue|lethargic|unconscious)/i, label: 'Pediatric emergency' },
];

export function scanRedFlags(text: string): string[] {
  const found: string[] = [];
  for (const { pattern, label } of RULES) {
    if (pattern.test(text)) found.push(label);
  }
  return found;
}
