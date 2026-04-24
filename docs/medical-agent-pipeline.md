# Nova Medical Agent — Unified Pipeline Design

**Version:** 2.0  
**Replaces:** `mini_doctor.pdf`, `mlplan.md`  
**Target:** Chat service (`services/chat`) — AI/ML implementation guide

---

## Table of Contents

1. [Overview](#1-overview)
2. [Core Data Models](#2-core-data-models)
3. [Pipeline Stages](#3-pipeline-stages)
4. [ML Components](#4-ml-components)
5. [Safety Architecture](#5-safety-architecture)
6. [Conversation Continuity](#6-conversation-continuity)
7. [LLM Failure Handling](#7-llm-failure-handling)
8. [Lab Test Integration](#8-lab-test-integration)
9. [Multilingual Support](#9-multilingual-support)
10. [GraphQL API Design](#10-graphql-api-design)
11. [Phase-wise Implementation](#11-phase-wise-implementation)
12. [Technical Stack](#12-technical-stack)

---

## 1. Overview

The medical agent is a checkpoint-gated pipeline. Each stage produces a structured output that becomes input to the next. No stage is skipped. No assumption is carried forward without data.

```
Stage 1  — Profile Check (onboarding fields, health form future scope)
Stage 2  — Regional Prior (Pinecone lookup, Redis cached)
Stage 3  — Drug Interaction Hard Check
Stage 4  — Risk Fusion → PriorRiskProfile (invisible prior)
Stage 5  — Adaptive Symptom Questioning (budget-limited)
Stage 6  — Red Flag Intercept (hard gate)
Stage 7  — ML Differential Scoring (profile-aware)
Stage 8  — Lab Test Mapping
Stage 9  — Safety Guardrail (runs on every output)
Stage 10 — Structured Output + Action
Stage 11 — Follow-up Scheduling (48hr check-in)
```

**Key design principles:**
- Safety first — always bias toward caution
- Profile-aware — available profile fields shape every decision; confidence scales with completeness
- Multilingual — Hindi, English, Hinglish throughout
- No definitive diagnosis — suggest possibilities only
- Audit trail — every session and escalation is logged

---

## 2. Core Data Models

### 2.1 UserProfile
Sourced from onboarding + health form. Agent confidence scales with completeness.

```typescript
interface UserProfile {
  // ✅ Available now (onboarding flow)
  name: string;
  age: number;                    // derived from dateOfBirth
  dateOfBirth: string;
  sex: 'MALE' | 'FEMALE' | 'OTHER';
  heightCm: number;
  weightKg: number;
  bmi: number;                    // auto-calculated
  language: 'EN' | 'HI' | 'HINGLISH';
  city?: string;                  // collected during profile setup (alongside height/weight)

  // 🔜 Future scope (health form — to be built)
  bloodGroup?: string;

  // Medical history
  conditions?: string[];          // Diabetes, Hypertension, Asthma, Thyroid...
  medications?: { name: string; dosage: string }[];
  allergies?: {
    drugs: string[];
    food: string[];
    environmental: string[];
  };
  surgeries?: string[];

  // Family history
  familyHistory?: {
    diabetes: boolean;
    heartDisease: boolean;
    cancer: boolean;
    mentalIllness: boolean;
  };

  // Lifestyle
  smoker?: 'NEVER' | 'FORMER' | 'CURRENT';
  alcohol?: 'NEVER' | 'OCCASIONAL' | 'REGULAR';
  activityLevel?: 'SEDENTARY' | 'LIGHT' | 'MODERATE' | 'HIGH';
  dietType?: 'OMNIVORE' | 'VEGETARIAN' | 'VEGAN' | 'HIGH_SUGAR' | 'OTHER';

  // Occupation
  jobType?: 'DESK' | 'FIELD' | 'INDUSTRIAL' | 'HEALTHCARE' | 'STUDENT' | 'UNEMPLOYED';

  // Mental health
  stressLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  anxietyOrDepression?: boolean;

  // Meta
  completenessScore: number;      // 0–100, drives agent confidence
  version: number;
  updatedAt: string;
}
```

**Completeness scoring:**
- Critical (age, sex) = always available from onboarding
- Important (conditions, medications, allergies, city) = 60% weight — gated on health form
- Optional (lifestyle, family history, mental health) = 40% weight
- Agent confidence is capped proportionally to completeness score

---

### 2.2 RegionalRisk
Built in Stage 2. Cached per `city + month`. TTL: 30 days.

```typescript
interface RegionalRisk {
  city: string;
  country: string;
  month: number;
  endemic: string[];            // Dengue, Typhoid, Malaria...
  seasonal: string[];           // Flu, Pollen allergy...
  environmental: {
    pm25Level: 'LOW' | 'MODERATE' | 'HIGH' | 'HAZARDOUS';
    waterQuality: 'GOOD' | 'MODERATE' | 'POOR';
  };
  activeOutbreaks: string[];
  generatedAt: string;
}
```

---

### 2.3 PriorRiskProfile
Built in Stage 4 by fusing UserProfile + RegionalRisk. Never shown to user.

```typescript
interface PriorRiskProfile {
  highRiskConditions: string[];   // e.g. "Diabetic → watch for infections"
  ruledOut: string[];             // e.g. "Vaccinated Hep B → deprioritize"
  watchlist: RankedCondition[];   // top 7 probable conditions with scores
  drugSymptomFlags: string[];     // medications that could cause symptoms
  demographicFlags: string[];     // age/sex/BMI risk factors
  regionFlags: string[];          // endemic/seasonal/outbreak alerts
}

interface RankedCondition {
  condition: string;
  score: number;                  // 0–1
  reasons: string[];
}
```

---

### 2.4 SymptomSet
Built in Stage 5 from conversation.

```typescript
interface SymptomSet {
  chiefComplaint: string;
  symptoms: ExtractedSymptom[];
  duration: { value: number; unit: 'hours' | 'days' | 'weeks' };
  pattern: 'CONSTANT' | 'INTERMITTENT' | 'WORSENING' | 'IMPROVING';
  socrates: {
    site: string;
    onset: string;
    character: string;
    radiation?: string;
    associated: string[];
    timing: string;
    exacerbating: string[];
    relieving: string[];
    severity: number;            // 1–10
  };
  functionalImpact: {
    eating: boolean;
    sleeping: boolean;
    working: boolean;
  };
  medicationTaken?: string;
  redFlagsPresent: boolean;
  language: 'EN' | 'HI' | 'HINGLISH';
}

interface ExtractedSymptom {
  name: string;                  // standardized English
  originalText: string;          // as user typed
  bodyPart?: string;
  severityKeyword?: string;
  confidence: number;
}
```

---

### 2.5 DiagnosisSession
Stored per conversation in MongoDB. Provides continuity across sessions and is the source of truth for LLM context.

```typescript
interface DiagnosisSession {
  id: string;
  userId: string;
  profileId: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ESCALATED' | 'ABANDONED';
  stage: number;                 // current pipeline stage (0–11)

  userProfile: UserProfile;
  regionalRisk?: RegionalRisk;
  priorRiskProfile?: PriorRiskProfile;
  symptomSet?: SymptomSet;
  differentialDiagnosis?: DifferentialResult;
  output?: DiagnosisOutput;

  // Conversation history (for audit + LLM rolling window)
  messages: {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }[];

  questionCount: number;         // tracks question budget (max 7)
  redFlagTriggered: boolean;
  escalationReason?: string;
  llmFailureCount: number;       // consecutive LLM failures — ABANDONED at 3

  followUpScheduled?: string;    // ISO timestamp
  followUpResponse?: FollowUpResponse;

  createdAt: string;
  updatedAt: string;
}
```

---

### 2.6 DiagnosisOutput

```typescript
interface DiagnosisOutput {
  severity: 'LOW' | 'MODERATE' | 'HIGH' | 'EMERGENCY';
  probableCauses: {
    condition: string;
    confidence: number;          // 0–1
    explanation: string;
  }[];
  ruledOut: { condition: string; reason: string }[];
  action: 'SELF_CARE' | 'MONITOR' | 'VISIT_DOCTOR' | 'ER_NOW';
  actionDetail: string;
  homeRemedies: RemedyResult[];
  labTestsRecommended: LabTestRecommendation[];
  watchFor: string[];            // warning signs to re-assess
  disclaimer: string;
  emergencyNumber?: '108';
  language: 'EN' | 'HI' | 'HINGLISH';
}

interface RemedyResult {
  nameEn: string;
  nameHi: string;
  preparationEn: string;
  preparationHi: string;
  ingredients: string[];
  source: 'AYURVEDA' | 'WHO' | 'TRADITIONAL' | 'CLINICAL';
}

interface LabTestRecommendation {
  testName: string;
  slug: string;                  // links to Nova content catalog
  reason: string;                // why this test is recommended
  urgency: 'ROUTINE' | 'SOON' | 'URGENT';
}

interface DifferentialResult {
  probableCauses: {
    condition: string;
    confidence: number;
    reasons: string[];
  }[];
  ruledOut: { condition: string; reason: string }[];
  flag?: 'GENERIC' | 'SEVERE';  // set when no condition clears 0.35 threshold
  generatedAt: string;
}

interface FollowUpResponse {
  answeredAt: string;
  outcome: 'IMPROVED' | 'SAME' | 'WORSENED' | 'SAW_DOCTOR';
  doctorDiagnosis?: string;      // optional, for training signal
  notes?: string;
}
```

---

## 3. Pipeline Stages

### Stage 1 — Profile Check
**Checkpoint:** Onboarding profile exists with at least age + gender

**Current fields (from onboarding flow):**
| Field | Source | Used for |
|-------|--------|----------|
| name | auth signup | greeting |
| dateOfBirth → age | profile setup | age-based risk, severity boosters |
| gender | profile setup | demographic scoring |
| height + weight → BMI | profile setup | obesity/underweight flags |
| language | auth signup | response language |
| city | profile setup (alongside height/weight) | regional risk lookup |

- If profile already exists (returning user) → skip to Stage 2
- If profile incomplete (missing age or gender) → block, redirect to complete profile first

**Future scope fields** (not collected yet — added when health form is built):
- Known conditions (diabetes, hypertension, thyroid...)
- Current medications
- Allergies (drug, food, environmental)
- Family history
- Lifestyle (smoking, alcohol, activity level, diet)
- Occupation + exposure
- Mental health indicators

---

### Stage 2 — Regional Research
**Checkpoint:** `RegionalRisk` retrieved for user's city/state

**Approach:** One-time Pinecone index of regional disease data. No live API calls needed.

**Pinecone index: `nova-regional-risk`**
```
Each document = one region entry
Text embedded: "{city/state/region} {month} common diseases endemic seasonal"
Metadata: { region, state, month, diseases[], seasonal[], endemic[] }
```

**Sample data entries:**
```
Mumbai, Maharashtra, Jun–Sep → Dengue, Leptospirosis, Malaria, Gastroenteritis
Delhi, Jun–Sep → Dengue, Chikungunya, Typhoid
Delhi, Oct–Feb → Respiratory infections, Fog-related asthma
India-wide, Jan–Mar → Influenza, Viral fever
India-wide, Mar–May → Heatstroke, GI infections, Dehydration
Rajasthan, Mar–Jun → Heatstroke, Malaria
Northeast, Jun–Sep → Malaria, Japanese Encephalitis
```

**Retrieval:**
```
user city + current month
  ↓
Pinecone similarity search → top match
  ↓
RegionalRisk { endemic[], seasonal[], month }
```

- City comes from user profile (collected during profile setup alongside height/weight)
- If city not in profile → use India-wide fallback, lower confidence noted in output
- Cache result in Redis per `city+month`, TTL 30 days (region data doesn't change often)

**Future scope:** Live API integration (OpenAQ for air quality, IDSP for outbreak alerts)

---

### Stage 3 — Drug Interaction Hard Check
**Checkpoint:** Drug-symptom conflicts identified before risk fusion

**If medications are in profile:** Run drug-symptom lookup against a static dictionary before building PriorRiskProfile. This is a **hard check, not a score modifier**.

```
Metformin → GI symptoms (nausea, diarrhea)
ACE inhibitors → Dry cough
Statins → Muscle pain, fatigue
SSRIs → Insomnia, nausea, headache
Antihistamines → Drowsiness, dry mouth
Beta-blockers → Fatigue, cold extremities
```

**If medications not in profile (Phase 1):** Ask as an early question in Stage 5 Block A:
> "Are you currently taking any medicines regularly?"
If yes → extract drug name → run lookup → flag before continuing

If a drug-symptom match is found:
- Flag it in `PriorRiskProfile.drugSymptomFlags`
- Agent asks about it early in symptom questioning
- If high confidence → surface in output before disease prediction

---

### Stage 4 — Risk Fusion
**Checkpoint:** `PriorRiskProfile` ready with ranked watchlist

Cross-merge `UserProfile` + `RegionalRisk` + drug flags. Uses only fields that are actually available — missing fields are skipped, not assumed.

**Scoring weights (applied only when field is present):**

| Factor | Weight | Available Phase 1? |
|--------|--------|--------------------|
| Demographic match (age, sex, BMI) | 30% | ✅ Always |
| Regional endemic/outbreak match | 25% | ✅ If city provided |
| User's existing conditions | 20% | 🔜 Health form |
| Family history | 15% | 🔜 Health form |
| Lifestyle (smoking, diet, activity) | 10% | 🔜 Health form |

**Phase 1 reality:** With only age + sex + BMI + region, the watchlist will be demographic + region-based only. Confidence score will reflect this. Agent communicates lower certainty to user.

Build:
- `highRiskConditions` — personalized risk statements shown to agent (not user)
- `ruledOut` — conditions to deprioritize based on available data
- `watchlist` — top 7 ranked probable conditions

This becomes the **invisible prior**. Every question in Stage 5 is biased by it.

---

### Stage 5 — Adaptive Symptom Questioning
**Checkpoint:** All blocks completed OR question budget exhausted (max 7 questions)

Agent talks to user. **One question at a time.** Questions are biased by `PriorRiskProfile`.

**Block A — Chief Complaint (1 question, mandatory)**
> "What is bothering you the most right now?"

**Block B — Duration (2–3 questions)**
> "When did this start?"  
> "Is it constant or does it come and go?"  
> "Is it getting worse, staying the same, or improving?"

Duration logic:
| Duration | Implication |
|----------|-------------|
| < 3 days | Likely acute / infectious |
| 3–14 days | Sub-acute, monitor closely |
| > 2 weeks | Chronic / needs investigation |
| Recurring | Pattern-based or autoimmune |

**Block C — SOCRATES (adaptive, 3–5 questions)**

Standard order: Site → Onset → Character → Radiation → Associated → Timing → Exacerbating/Relieving → Severity (1–10)

**Adaptive bias from PriorRiskProfile:**
- If diabetic + fatigue → ask about polyuria, polydipsia first
- If dengue region + fever → ask about rash, joint pain, retro-orbital pain immediately
- If smoker + cough → ask about blood in sputum, duration, weight loss
- If high PM2.5 + breathlessness → ask about duration, whether at rest or exertion

**Passive red flag scanning (runs on EVERY user message, not just Block D)**

Before processing any message in Stage 5, scan raw text for red flag keywords. This catches users who describe emergencies naturally without waiting for Block D.

```typescript
const RED_FLAG_PATTERNS = [
  /chest.*(pain|tight|pressure|crush)/i,
  /left.arm.*(pain|numb)/i,
  /can.*(breathe|breath)/i,
  /worst.*headache/i,
  /face.*(droop|numb|weak)/i,
  /can.*speak|speech.*slur/i,
  /blood.*(stool|urine|vomit)/i,
  /unconsci|faint|collapse/i,
  /seene mein dard|sans nahi|behosh/i,  // Hindi
  /kill.*myself|suicide|end.*life/i,
];
```

If any pattern matches → immediately route to Stage 6, skip remaining blocks.

**Block D — Red Flag Screen (explicit question, mandatory)**

Asked once, after Block C. Any YES → Stage 6.

| Red Flag | Possible Condition |
|----------|-------------------|
| Chest pain + left arm radiation | Heart attack |
| Sudden severe headache ("worst of life") | Subarachnoid hemorrhage |
| Facial drooping + speech difficulty | Stroke |
| Difficulty breathing at rest | Respiratory emergency |
| Blood in stool / urine | Internal bleeding |
| Loss of consciousness | Multiple causes |
| Severe allergic reaction (swelling, breathlessness) | Anaphylaxis |
| Sudden paralysis or numbness | Stroke |
| Seizures | Neurological emergency |
| Suicidal ideation | Mental health crisis |

**Block E — Functional Impact (2 questions)**
> "Are you able to eat, sleep, and do daily activities normally?"  
> "Have you taken any medication for this?"

**Question budget breakdown (max 7):**
| Block | Questions |
|-------|-----------|
| A — Chief complaint | 1 |
| B — Duration + pattern | 1–2 |
| C — SOCRATES (adaptive) | 2–3 |
| D — Red flag screen | 1 (inline, yes/no) |
| E — Functional impact | 1 |

After 7 questions → conclude with available data. Note lower confidence in output if any block was skipped.

---

### Stage 6 — Red Flag Intercept
**Checkpoint:** Hard gate — escalate immediately if triggered

If any red flag from Block D is confirmed:
1. Stop pipeline immediately
2. Set `session.status = 'ESCALATED'`
3. Return emergency response with `action: 'ER_NOW'`
4. Include emergency number: 108
5. Log escalation with reason for audit

Emergency response bypasses Stages 7–8 and goes directly to Stage 9 (safety guardrail) → Stage 10 (output).

---

### Stage 7 — Differential Scoring
**Checkpoint:** `DifferentialResult` produced with at least one condition OR `GENERIC`/`SEVERE` flag

**Input:** `SymptomSet` + `PriorRiskProfile` + `UserProfile`

**Approach:** Single LLM call with all available context injected. Returns structured JSON.

**LLM prompt:**
```
You are a clinical decision support assistant. Based on the data below, rank the most probable conditions.

Patient:
- Age: {age}, Sex: {sex}, BMI: {bmi}
- Known conditions: {conditions || "not provided"}
- Medications: {medications || "not provided"}
- Allergies: {allergies || "not provided"}

Regional context (current month):
- Endemic diseases in {city}: {regionFlags}
- Seasonal risks: {seasonal}

Drug flags:
- {drugSymptomFlags || "none"}

Symptoms reported:
- Chief complaint: {chiefComplaint}
- Symptoms: {symptoms[].name} ({symptoms[].confidence} confidence each)
- Duration: {duration.value} {duration.unit}, pattern: {pattern}
- Severity: {socrates.severity}/10
- Functional impact: eating={functionalImpact.eating}, sleeping={functionalImpact.sleeping}
- Medication taken: {medicationTaken || "none"}

Watchlist prior (from profile + region):
{priorRiskProfile.watchlist top 5}

Return ONLY valid JSON matching this schema:
{
  "probableCauses": [
    { "condition": "string", "confidence": 0.0–1.0, "reasons": ["string"] }
  ],
  "ruledOut": [
    { "condition": "string", "reason": "string" }
  ],
  "flag": "GENERIC" | "SEVERE" | null
}

Rules:
- Only include conditions with confidence > 0.35
- Maximum 3 probable causes, ordered by confidence descending
- Set flag="SEVERE" if symptoms suggest emergency but no clear condition matches
- Set flag="GENERIC" if max confidence < 0.35 and no emergency indicators
- Cite specific reasons from the data provided — do not hallucinate
- If drug flag explains the symptom better than a disease, note it in ruledOut
```

**Safety adjustment (applied after LLM response):**
```
if top confidence < 0.50 → add uncertainty note to output
if flag === 'SEVERE' → override severity to HIGH, route to ER advice
if flag === 'GENERIC' → severity LOW, self-care advice
```

**Always bias toward caution** — if unsure between MODERATE and HIGH, choose HIGH.

---

### Stage 8 — Lab Test Mapping
**Checkpoint:** Lab tests mapped from differential

From the top 3 probable causes, recommend relevant tests from the Nova lab test catalog.

**Mapping examples:**
```
Thyroid symptoms → TSH, T3, T4
Diabetes symptoms → FBS, HbA1c, PP2BS
Anemia symptoms → CBC, Serum Ferritin, Iron Studies
Dengue → NS1 Antigen, Dengue IgM/IgG
Liver issues → LFT, Bilirubin
Kidney → KFT, Creatinine, Urine R/M
Heart → ECG, Troponin, Lipid Profile
General fever → CBC, ESR, CRP, Malaria Antigen
```

Output: `LabTestRecommendation[]` from our content service catalog.

Only recommend tests when `severity >= MODERATE`. For LOW severity, suggest home monitoring.

---

### Stage 9 — Safety Guardrail
**Checkpoint:** Every response passes safety filter before showing to user

Runs on **every output**, no exceptions. Full architecture defined in [Section 5 — Safety Architecture](#5-safety-architecture).

**Summary:**
- Layer 1: Regex rules (crisis detection, language softener, medication blocker, disclaimer append)
- Layer 2: OpenAI Moderation API (self-harm, violence, harassment categories)
- Audit log on every response regardless of outcome

Any response that fails moderation is **blocked** — user sees a safe fallback, never the flagged response.

---

### Stage 10 — Structured Output
**Checkpoint:** `DiagnosisOutput` generated and shown to user

```
[SEVERITY BADGE]  MODERATE

Most probable causes:
1. Viral Upper Respiratory Infection (78% match)
   Based on: your symptoms + flu season in Mumbai + no chronic conditions
2. Dengue Fever (45% match)
   Watch for: rash, joint pain, retro-orbital pain

Ruled out:
• Bacterial pneumonia — no breathlessness, no high fever

Recommended action: Monitor at home. See a doctor if no improvement in 3 days.

Home remedies:
• Adrak ki chai — 2–3 times daily
• Haldi doodh — at night
• Rest and fluids

Lab tests to consider:
• CBC + CRP (if fever persists beyond 3 days)

Watch for these warning signs:
• Fever > 103°F
• Rash or joint pain → visit doctor same day (dengue risk)

⚠️ [Disclaimer]
```

---

### Stage 11 — Follow-up Scheduling
**Checkpoint:** Follow-up response received OR 72hr window expires

**Trigger mechanism:** When `DiagnosisOutput` is stored, set `session.followUpScheduled` to `now + 48hr`. A cron job in the chat service polls every hour for sessions where:
```
status = 'COMPLETED'
AND followUpScheduled <= now
AND followUpResponse IS NULL
```

**Phase 1 — in-app prompt only** (no push notification infrastructure yet):
- On user's next app open, show follow-up card before any new session starts
- "Last time you told us about [chiefComplaint]. How are you feeling now?"
- Options: Better / Same / Worse / I saw a doctor

**Phase 2 — push notification** via FCM (Firebase Cloud Messaging, already in stack):
- Store FCM token on user profile at login
- Cron sends push at 48hr mark
- Deep link opens follow-up screen in app

**Outcomes:**
| Response | Action |
|----------|--------|
| IMPROVED | `session.status = 'COMPLETED'`, no action needed |
| SAME | Suggest doctor visit if not already done |
| WORSENED | Re-open session → Stage 5 with previous SymptomSet as context |
| SAW_DOCTOR | Ask for diagnosis (optional) → store as `doctorDiagnosis` for future training signal |

**If no response in 72hr:** Mark session `COMPLETED` (assume improved or disengaged). Do not harass user.

Store `FollowUpResponse` on `DiagnosisSession`.

---

## 4. ML Components

### 4.1 Symptom Extractor

**Processing pipeline:**

```
Raw text (EN / HI / HINGLISH)
  ↓
Language detection (langdetect + script check)
  ↓
Transliteration/normalization (Hindi → English medical terms)
  ↓
NER — extract: SYMPTOM, BODY_PART, DURATION, SEVERITY, FREQUENCY
  ↓
Standardization (head pain / sir dard / headache → "headache")
  ↓
ExtractedSymptom[]
```

**Symptom dictionary structure:**
```typescript
{
  "headache": {
    variations: ["head pain", "head ache", "sir dard", "sir mein dard", "सिर दर्द"],
    bodyPart: "head",
    category: "neurological",
    redFlag: false
  },
  "chest pain": {
    variations: ["seene mein dard", "chest mein dard", "सीने में दर्द"],
    bodyPart: "chest",
    category: "cardiovascular",
    redFlag: true
  }
  // 300+ symptoms
}
```

**Phase 1:** Rule-based dictionary (300+ symptoms, Hindi/Hinglish mappings)  
**Phase 2:** LLM fallback when rule-based confidence < 0.6  
**Phase 3:** Fine-tuned MuRIL NER model

---

### 4.2 Disease Classifier

**Approach:** LLM with structured JSON output and full profile context injection. No separate model, no Python runtime.

**LLM prompt structure:**
```
Given:
- Symptoms: {symptomSet}
- Patient: age {age}, sex {sex}, BMI {bmi}
- Known conditions: {conditions or "none provided"}
- Regional risk: {regionFlags}
- Drug flags: {drugSymptomFlags}
- Watchlist prior: {priorRiskProfile.watchlist}

Return JSON:
{
  "probableCauses": [
    { "condition": "...", "confidence": 0.0–1.0, "reasons": ["..."] }
  ],
  "ruledOut": [
    { "condition": "...", "reason": "..." }
  ]
}
```

**Output rules:**
- Only include conditions with confidence > 0.35
- Maximum 3 probable causes
- If top confidence < 0.50 → add uncertainty disclaimer in output
- LLM must cite reasons from the injected profile data (not hallucinate)

---

### 4.3 Severity Classifier

**Classification order (hard rules first, LLM for nuanced cases):**

```
Step 1: Emergency hard rules (regex on symptoms) → EMERGENCY
        e.g. chest pain + radiation, stroke signs, anaphylaxis

Step 2: Serious hard rules → HIGH
        e.g. blood in stool/urine, high fever >104°F in child, loss of consciousness

Step 3: LLM severity assessment using full profile + symptomSet → LOW / MODERATE / HIGH

Step 4: Safety adjustment:
  - LLM says LOW with top differential confidence < 0.50 → bump to MODERATE
  - Age > 65 or immunocompromised → bump one level up
  - Child < 5 with fever → bump one level up
  - Pregnancy → bump one level up for most conditions
```

**Additional profile-based severity boosters:**
- Age > 65 → bump severity one level up
- Immunocompromised (diabetes, HIV) → bump one level up
- Pregnancy → bump one level up for most conditions
- Child < 5 → bump one level up for fever conditions

---

### 4.4 Remedy Retriever (RAG)

**Vector DB:** Pinecone (managed, free tier — 1 index with namespaces, 2GB)

**Index structure:**
```
Index name: nova-medical
Metric: cosine
Dimension: 768  (Gemini text-embedding-004)

Namespaces:
  remedies        — 300+ home remedies (fully stored in metadata)
  regional-risk   — city/state → disease mappings (Stage 2)
```

**Remedy — fully in Pinecone (no MongoDB):**
```typescript
// Each Pinecone vector record
{
  id: "remedy_001",
  values: [...768-dim embedding...],
  metadata: {
    nameEn: "Ginger tea",
    nameHi: "Adrak ki chai",
    conditions: ["cold", "fever", "flu"],
    symptoms: ["sore throat", "runny nose", "body ache"],
    ingredients: ["ginger", "water", "honey"],
    preparationEn: "Boil fresh ginger in water for 10 mins, add honey.",
    preparationHi: "अदरक को पानी में 10 मिनट उबालें, शहद मिलाएं।",
    safetyGeneral: true,
    safetyChildren: true,
    safetyPregnancy: false,
    safetyElderly: true,
    contraindications: ["blood thinners"],
    allergens: [],
    source: "AYURVEDA",
    credibilityScore: 0.9
  }
}
```

Seeded once via a script. Remedies are static — no MongoDB collection needed.

**What gets embedded:**
```
"${nameEn} — treats ${conditions.join(', ')} — symptoms: ${symptoms.join(', ')} — ingredients: ${ingredients.join(', ')}"
```

**Retrieval pipeline:**
```
symptoms[] + probableCauses[] + userProfile
  ↓
Build query: "home remedy for {chief_complaint} {top_condition} symptoms: {symptom_list}"
  ↓
Generate embedding (Gemini text-embedding-004)
  ↓
Pinecone similarity search (namespace: remedies) → top 15 candidates
  ↓
Safety filter using metadata (no secondary DB lookup needed):
  - allergens ∩ userProfile.allergies → remove
  - contraindications ∩ userProfile.conditions → remove
  - safetyChildren=false + age < 12 → remove
  - safetyPregnancy=false + pregnant → remove
  ↓
Re-rank:
  50% Pinecone similarity score
  30% credibilityScore
  20% symptom overlap count
  ↓
Top 3–5 remedies → returned directly from metadata
```

**Embedding model:** Gemini `text-embedding-004` (free, 768-dim). No extra cost.

---

### 4.5 Response Generator

**Phase 1:** LLM-generated response with full pipeline context injected and safety guardrail applied.

**System prompt:**
```
You are Nova — a friendly, caring health companion for Indian users.
You help people understand their symptoms and decide what to do next.
You are NOT a doctor. You do NOT diagnose. You suggest possibilities and next steps.

You MUST:
- Respond in {language} (Hindi / English / Hinglish — match the user's language exactly)
- Use simple language a non-medical person can understand
- Be warm, empathetic, never clinical or cold
- Always include the disclaimer at the end
- Include emergency number 108 if severity is HIGH or EMERGENCY

You MUST NEVER:
- Say "You have [disease]" — always say "your symptoms may indicate" or "could be"
- Name specific medications or dosages
- Tell the user to stop their current medications
- Discourage seeing a doctor
- Make promises about recovery or outcomes
```

**Final output call context injected:**
```
Diagnosis result: {differentialResult}
Severity: {severity}
Recommended action: {action}
Home remedies (pre-filtered for allergies): {remedies[]}
Lab tests recommended: {labTests[]}
User's language: {language}
```

**Phase 2:** Few-shot examples from confirmed doctor diagnoses injected into prompt for improved accuracy.

---

## 5. Safety Architecture

Every agent response passes through this layer — no exceptions. Two layers: fast regex first, LLM moderation second.

```
LLM response generated
  ↓
[1] LAYER 1 — Regex / rule-based (fast, free, synchronous)
    ↓
    [1a] Crisis pattern scan (regex on response text)
         → suicidal/self-harm → override → crisis resources
    ↓
    [1b] Diagnostic language softener
         → "you have X" → "your symptoms may indicate X"
    ↓
    [1c] Medication blocker
         → remove drug names + dosages from response
    ↓
    [1d] Emergency completeness
         → severity=EMERGENCY + "108" missing → append
    ↓
    [1e] Disclaimer check
         → disclaimer missing → append in user's language
  ↓
[2] LAYER 2 — LLM moderation (OpenAI Moderation API — free)
    → categories: self-harm, violence, harassment
    → if flagged → block response, show safe fallback
    → only runs on final response (not mid-pipeline)
  ↓
[3] Audit log
    → log session_id, stage, severity, escalation_reason, moderation_result
  ↓
Safe response → user
```

**Why two layers:**
- Regex is instant and free — catches obvious cases with zero latency
- OpenAI Moderation API is free and catches nuanced self-harm/crisis language that regex misses
- Together they cover both structured and natural language edge cases

**LLM fallback if moderation flags response:**
```
"I want to make sure I'm giving you the right support.
 Please speak to a doctor or call 108 if this is urgent.
 [Crisis resources if self-harm detected]"
```

**Crisis resources (always shown when detected):**
- iCall: 9152987821
- Vandrevala Foundation: 1860-2662-345
- NIMHANS: 080-46110007
- Emergency: 108

---

## 6. Conversation Continuity

### Conversation history strategy

The LLM is stateless. Every call must carry enough context to continue naturally — but sending the full message history is expensive and hits context limits fast.

**Approach: structured state + rolling window**

On every LLM call, the payload is:
```
1. System prompt (pipeline rules, safety constraints, user language)
2. Serialized session state (structured, not chat):
   - Current stage
   - PriorRiskProfile summary (watchlist top 3, flags)
   - SymptomSet built so far (partial is fine)
   - Question count remaining
3. Last 4 messages only (rolling window)
4. Next instruction (what block to execute)
```

After each LLM response:
- Extract structured data from it (new symptoms, answers, red flag mentions)
- Update `DiagnosisSession` fields immediately (symptomSet, stage, questionCount)
- Append raw message to `session.messages[]` for audit
- Never replay full `messages[]` to LLM — session state IS the memory

**Why this works:**
- Session state is always fresh and structured — LLM doesn't need to re-read history to know what's been established
- 4-message window gives enough conversational flow without ballooning cost
- `messages[]` in MongoDB is the audit trail, not the LLM context

**Context size estimate per call:**
```
System prompt:       ~500 tokens
Session state:       ~300 tokens
Last 4 messages:     ~200 tokens
Total:               ~1000 tokens per call — well within limits
```

---

### Session lifecycle

```
NEW SESSION
  → create DiagnosisSession (status: IN_PROGRESS, messages: [])
  → if UserProfile exists → skip Stage 1
  → if RegionalRisk cached (Redis) → skip Stage 2
  → proceed from appropriate stage

USER DROPS OFF
  → session stays IN_PROGRESS
  → on return → load session state → resume from last completed stage
  → show: "Last time you told me about [chief complaint]. Want to continue?"
  → last 4 messages give natural re-entry point

SESSION COMPLETE
  → status: COMPLETED
  → store DiagnosisOutput
  → schedule follow-up (Stage 11)

FOLLOW-UP: WORSENED
  → re-open session
  → Stage 5 with previous SymptomSet injected into state
  → "Last time: fever 2 days. Now how are you?"
```

### Using past sessions as context

When a new session starts, agent checks for past completed sessions:
- Same condition recurring → flag as "pattern-based or chronic"
- Multiple sessions worsening → boost severity one level
- Past diagnosis confirmed by doctor → use as few-shot signal (Phase 3)

---

## 7. LLM Failure Handling

Every LLM call in the pipeline must be wrapped with retry + fallback. A mid-pipeline failure leaves the session `IN_PROGRESS` forever without this.

### Per-call wrapper
```typescript
async function callLLMWithFallback(
  prompt: string,
  stage: number,
  session: DiagnosisSession
): Promise<string> {
  const MAX_RETRIES = 2;
  const TIMEOUT_MS = 15000;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await Promise.race([
        callLLM(prompt),
        timeout(TIMEOUT_MS),
      ]);
      return result;
    } catch (err) {
      if (attempt === MAX_RETRIES) {
        // Log failure with stage context
        await logLLMFailure(session.id, stage, err);
        return getStageFallback(stage, session);
      }
      await sleep(500 * (attempt + 1)); // exponential backoff
    }
  }
}
```

### Stage fallbacks (what to show user when LLM fails)

| Stage | Fallback behavior |
|-------|------------------|
| Stage 5 (questioning) | Ask a generic safe question: "Can you describe your symptoms in more detail?" |
| Stage 7 (differential) | Return `{ flag: 'GENERIC', severity: 'MODERATE' }` — conservative, prompts doctor visit |
| Stage 9 (safety) | Block the response entirely, show: "Please consult a doctor for advice on this." |
| Stage 10 (output) | Show generic safe template: "Based on your symptoms, we recommend consulting a doctor." |
| Any stage | Never leave session `IN_PROGRESS` with no response — always give user something |

### Session recovery
- On LLM failure mid-session → session stays `IN_PROGRESS`
- On next user message → detect incomplete stage → retry from last checkpoint
- If 3 consecutive LLM failures → set `session.status = 'ABANDONED'`, notify user to try again

---

## 8. Lab Test Integration

Lab test recommendations come from the Nova content service catalog (`searchLabTests`, `labTestsByTag`).

### Symptom → Test mapping

| Probable Condition | Recommended Tests |
|-------------------|------------------|
| Thyroid disorder | TSH, T3, T4, Anti-TPO |
| Diabetes | FBS, HbA1c, PP2BS |
| Anemia | CBC, Serum Ferritin, Iron Studies, B12 |
| Dengue | NS1 Antigen, Dengue IgM/IgG, CBC |
| Malaria | Malarial Antigen, MP Smear |
| Typhoid | Widal Test, Blood Culture |
| Liver | LFT, Bilirubin, SGPT, SGOT |
| Kidney | KFT, Creatinine, Urine R/M, eGFR |
| Heart | Lipid Profile, ECG, Troponin, CK-MB |
| Respiratory | CXR, CBC, Sputum Culture |
| General infection | CBC, ESR, CRP |
| UTI | Urine R/M, Urine Culture |
| Nutritional | Vitamin D, B12, Iron, Calcium |

**When to recommend:**
- Severity LOW → no tests (home monitoring)
- Severity MODERATE → suggest 1–2 targeted tests
- Severity HIGH → suggest full panel + see doctor

**Output format:**
```
Lab tests recommended before your doctor visit:
• CBC with Differential — to check for infection/anemia
• Dengue NS1 Antigen — important given your location (Mumbai, monsoon season)
[Book via Nova]
```

---

## 9. Multilingual Support

### Language detection

```
Input text
  ↓
Has Devanagari script? → Hindi
Has Latin + Hindi words? → Hinglish
Pure Latin → English
```

### Hindi/Hinglish symptom dictionary (sample)

| English | Devanagari | Romanized |
|---------|-----------|-----------|
| Fever | बुखार | bukhar |
| Headache | सिर दर्द | sir dard |
| Cough | खांसी | khansi |
| Cold | जुकाम | zukam |
| Stomach pain | पेट दर्द | pet dard |
| Vomiting | उल्टी | ulti |
| Diarrhea | दस्त | dast |
| Dizziness | चक्कर | chakkar |
| Body pain | बदन दर्द | badan dard |
| Weakness | कमज़ोरी | kamzori |
| Chest pain | सीने में दर्द | seene mein dard |
| Breathlessness | सांस फूलना | saans phoolna |
| Rash | दाने | dane |
| Swelling | सूजन | sujan |
| Numbness | सुन्नपन | sunnpan |

### Response language

- Detect language from first user message
- Maintain same language throughout session
- If user switches language mid-session → switch response language
- All templates available in EN, HI, HINGLISH

---

## 10. GraphQL API Design



The chat service exposes the medical agent pipeline via these operations. All require authentication (`ctx.userId`).

### Mutations

```graphql
# Start or resume a session. Returns existing IN_PROGRESS session if one exists.
mutation StartSession: DiagnosisSession!

# Send a message (user's answer or new input). Drives the pipeline forward.
# Returns the agent's next message + updated session stage.
mutation SendMessage($sessionId: ID!, $message: String!): MessageResponse!

# Submit follow-up response (Stage 11).
mutation SubmitFollowUp($sessionId: ID!, $outcome: FollowUpOutcome!, $doctorDiagnosis: String): DiagnosisSession!
```

### Queries

```graphql
# Get current active session for the user (if any).
query ActiveSession: DiagnosisSession

# Get a completed session with full output.
query Session($id: ID!): DiagnosisSession

# Get all past sessions for history view.
query SessionHistory($limit: Int, $offset: Int): [DiagnosisSession!]!
```

### Key types

```graphql
type DiagnosisSession {
  id: ID!
  status: SessionStatus!
  stage: Int!
  output: DiagnosisOutput
  createdAt: DateTime!
  updatedAt: DateTime!
}

type MessageResponse {
  message: String!           # agent's response text
  stage: Int!                # current stage after processing
  status: SessionStatus!     # updated session status
  requiresAction: ActionType # if user needs to do something (e.g. complete profile)
}

enum SessionStatus { IN_PROGRESS COMPLETED ESCALATED ABANDONED }
enum FollowUpOutcome { IMPROVED SAME WORSENED SAW_DOCTOR }
enum ActionType { COMPLETE_PROFILE ACCEPT_CONSENT NONE }
```

### Flow from frontend perspective
```
1. StartSession → get sessionId
2. SendMessage(sessionId, "I have fever...") → agent asks next question
3. SendMessage(sessionId, "Since 2 days") → agent asks next question
   ... repeat until stage=10
4. Session.output available → show DiagnosisOutput screen
5. (48hr later) SubmitFollowUp → session complete
```

---

## 11. Implementation Tracker

Steps are ordered by dependency — each step unblocks the next. Mark with `[x]` as completed.

Legend: `[ ]` not started · `[x]` done · `[~]` in progress

---

### Phase 1 — Core Pipeline (MVP)

#### Step 1 — Dependencies + Project Setup
- [x] Install: `mongoose`, `@pinecone-database/pinecone`, `@google/generative-ai`, `openai`, `ioredis`, `node-cron`
- [x] Add env vars: `PINECONE_API_KEY`, `PINECONE_INDEX` added to `.env`
- [x] Connect MongoDB in chat service (reuse `@nova/shared` db client)
- [x] Connect Redis client (singleton, reuse across service)

---

#### Step 2 — DiagnosisSession Model
- [x] `DiagnosisSession` Mongoose schema (all fields from Section 2.5)
- [x] `SessionService`: `create`, `getById`, `getActiveByUser`, `update`, `addMessage`
- [x] Index on `userId + status` for active session lookup
- [x] Index on `followUpScheduled` for cron query

---

#### Step 3 — GraphQL Schema + Resolvers (shell)
- [x] `StartSession` mutation — creates session, returns `DiagnosisSession`
- [x] `SendMessage` mutation — shell only (returns placeholder for now)
- [x] `SubmitFollowUp` mutation
- [x] `ActiveSession` query
- [x] `SessionHistory` query
- [x] All types: `DiagnosisSession`, `MessageResponse`, `DiagnosisOutput`, `SessionStatus`

---

#### Step 4 — Stage 1: Profile Check
- [x] On `StartSession`: profile snapshot from `x-user-profile` gateway header
- [x] Gate: if `age` or `gender` missing → return `ProfileIncompleteError`
- [x] Snapshot `UserProfile` fields onto session at creation

---

#### Step 5 — Pinecone Setup + Data Seeding
- [x] Seed script written (`seed-pinecone.ts`, run with `npm run seed:pinecone -w @nova/chat`)
- [x] Sample data: 10 remedies + 10 regional risk entries in `src/scripts/data/`
- [ ] Add `PINECONE_API_KEY` to `.env` and run seed script (requires Pinecone account)
- [ ] Verify retrieval with test queries

---

#### Step 6 — Stage 2: Regional Risk
- [x] `regionalRisk.ts`: query Pinecone `regional-risk` by city + month
- [x] Redis cache: key `regional:{city}:{month}`, TTL 30 days
- [x] Static India-wide fallback by month if city missing or Pinecone unavailable
- [x] Fires in background on `StartSession`

---

#### Step 7 — Stage 3: Drug Interaction Check
- [x] `drugCheck.ts`: 10 drug-symptom entries, expandable
- [x] Returns `drugSymptomFlags[]` from medications array
- [x] Integrated into background pipeline

---

#### Step 8 — Stage 4: Risk Fusion
- [x] `riskFusion.ts`: merges profile + regional risk + drug flags → `PriorRiskProfile`
- [x] Scoring uses only available fields, skips missing ones
- [x] Builds `watchlist` top 7 with scores + reasons
- [x] `StartSession` end-to-end: session created → stages 2–4 background → session at stage 5

---

#### Step 9 — Stage 5: LLM Conversation Loop
- [x] `pipeline/llm.ts`: Gemini 1.5 Flash wrapper, retry ×2, 15 s timeout, exponential backoff, `callLLMJson` helper
- [x] `pipeline/redFlags.ts`: passive regex scanner — 18 patterns (EN + HI), runs before every LLM call
- [x] `pipeline/systemPrompt.ts`: language-aware system instruction, serialised risk context + symptom state (~350 tokens)
- [x] `pipeline/conversationLoop.ts`: full Stage 5 orchestrator — block logic, red flag → ESCALATED, ANALYSIS_READY signal, max 7 questions
- [x] Rolling window: last 8 messages (4 exchanges) fed as Gemini history
- [x] Chief complaint captured from first user message → `symptomSet.chiefComplaint`
- [x] Incremental session updates: `questionCount`, `symptomSet`, `stage` on each turn
- [x] LLM failure: increment counter, ABANDONED at 3 failures
- [x] `sendMessage` mutation fully wired to `runConversationLoop`

---

#### Step 10 — Stage 6: Red Flag Intercept
- [x] Passive red flag regex scanner implemented in `pipeline/redFlags.ts` (runs before every LLM call)
- [x] Hindi patterns included (`saans nahi aa`, `seene mein dard`, `khoon aa raha`)
- [x] On trigger: `redFlagTriggered: true`, `status: ESCALATED`, stage → 6, emergency message returned
- [x] LLM `[EMERGENCY_ESCALATE]` signal also escalates session

---

#### Step 11 — Stage 7: Differential Scoring
- [x] `pipeline/differential.ts`: LLM prompt with full session context (symptoms + SOCRATES + risk profile)
- [x] `callLLMJson` for structured JSON output; clamps confidence to [0,1]
- [x] Fallback to "Undetermined" result if LLM fails or returns bad JSON
- [x] `DifferentialResult` persisted to session; stage advances to 8

---

#### Step 12 — Stage 8: Lab Test Mapping
- [x] `pipeline/labTests.ts`: static map for 17 conditions → `LabTestRecommendation[]`
- [x] Fuzzy key matching (e.g. "Dengue" matches "Dengue fever")
- [x] De-duplicated by slug; capped at 6 tests; skips if severity = LOW
- [x] Phase 2: content service query left as noted comment

---

#### Step 13 — Stage 4.4: Remedy Retrieval
- [x] `pipeline/remedyRetrieval.ts`: embeds `chiefComplaint + symptoms` → Pinecone top 15
- [x] Safety filter: allergens, contraindications, `safetyChildren` / `safetyPregnancy` / `safetyElderly`
- [x] Re-rank: 60% Pinecone score + 40% credibilityScore; returns top 4
- [x] Graceful no-op if `PINECONE_API_KEY` not set

---

#### Step 14 — Stage 9: Safety Guardrail
- [x] `pipeline/safetyGuardrail.ts` Layer 1: regex redacts definitive diagnosis language + prescription drug names
- [x] Layer 2: OpenAI Moderation API call — gracefully skipped if `OPENAI_API_KEY` not set
- [x] `blockedFallback()` per language (EN / HI / HINGLISH)

---

#### Step 15 — Stage 10: Structured Output
- [x] `pipeline/outputBuilder.ts`: `buildOutput()` assembles `DiagnosisOutput` from diff + remedies + labs
- [x] `deriveSeverity()`: EMERGENCY / HIGH / MODERATE / LOW based on diff flag + confidence
- [x] `formatOutputMessage()`: language-aware readable chat message (EN / HI / HINGLISH)
- [x] `pipeline/analysisPipeline.ts`: orchestrates stages 7–10 in sequence
- [x] Session: `status → COMPLETED`, `followUpScheduled = now + 48hr`, `output` persisted
- [x] `conversationLoop.ts` chains into `analysisPipeline` automatically at question 7
- [x] `sendMessage.ts` re-triggers analysis if stage stuck at 7 (edge case guard)

---

#### Step 16 — Stage 11: Follow-up Cron
- [x] `pipeline/followUpCron.ts`: `node-cron` hourly job
- [x] Query: `status=COMPLETED AND followUpScheduled <= now AND followUpResponse absent`
- [x] Phase 1: sets `followUpDue: true` on session — frontend shows in-app card
- [x] Auto-close: no response after 72 hr → clears `followUpScheduled`
- [x] `startFollowUpCron()` called in `index.ts` on server start
- [ ] `SubmitFollowUp` mutation: already wired in Step 3; WORSENED re-opens session to stage 5

---

#### Step 17 — End-to-end Test
- [x] Full flow tested via `tools/chat-test.html`: `StartSession` → `SendMessage` ×7 → output shown
- [x] Red flag path: "chest pain" → ESCALATED + emergency message
- [x] Completed session output verified: differential, lab tests, remedies, severity
- [ ] Session resume: drop off mid-conversation → reconnect → continue
- [ ] Follow-up: complete → 48hr → submit outcome → session closed
- [ ] LLM failure: kill LLM → fallback fires → session survives

---

### Step 18 — Profile Service (implemented)

- [x] `services/profile/src/models/profile.model.ts` — Mongoose model with chat fields
- [x] Profile schema extended: `city`, `language`, `conditions`, `medications`, `allergies`, `bmi`
- [x] `setupProfile` + `updateProfile` mutations accept new fields
- [x] `myProfile` query wired with full resolver
- [x] `connectDB()` added to profile service startup
- [x] `gateway/schemas/profile.graphql` updated to match

---

### Step 19 — Gateway Coprocessor: Profile Injection (implemented)

- [x] `coprocessor/src/index.ts` rewritten — removed Redis dependency
- [x] Fetches `myProfile` from profile service on every `RouterRequest`
- [x] 30s in-memory profile cache (reduces profile service load)
- [x] Injects `x-user-profile` header with computed age, heightCm, weightKg, bmi
- [x] Rate limiting migrated to in-memory Map (Redis-free)
- [x] `gateway/router.yaml` — coprocessor block added pointing to `http://localhost:4010`
- [x] Graceful fallback: profile fetch failure → empty header → chat service uses profile gate

---

### Step 20 — GraphQL Subscriptions (implemented)
- [x] `sessionUpdated(sessionId: ID!): SessionEvent!` subscription added to chat schema
- [x] `SessionEvent` type: `type`, `message`, `stage`, `status`, `requiresAction`, `output`
- [x] In-process `graphql-subscriptions` PubSub (no Redis needed for single-process Phase 1)
- [x] `sendMessage` refactored: returns `SendMessageAck { accepted, sessionId }` instantly → pipeline runs async via `setImmediate` → emits events
- [x] `conversationLoop.ts` emits `MESSAGE`, `STAGE_CHANGE`, `ESCALATED` events
- [x] Analysis pipeline emits `COMPLETED` event with full `DiagnosisOutput`
- [x] `withFilter` per-session event routing; WS context injects `userId` + `profile` from `connectionParams`
- [x] `graphql-ws` subscription handler wired in chat service `index.ts`
- [x] `router.yaml` — subscription passthrough enabled
- [x] `tools/chat-test.html` — native `graphql-transport-ws` protocol client, WS status indicator

---

### Phase 2 — Full Profile + Push

- [ ] Stage 3: use profile medications directly (no longer asked as question) — profile fields now available
- [ ] Stage 4: remedy safety filter uses actual allergy data from profile
- [ ] FCM push notification for Stage 11 (replace cron in-app flag)
- [ ] Session resume UX ("continue where you left off" card)
- [ ] Live regional data (OpenAQ air quality, IDSP outbreak alerts)
- [ ] Hinglish response tuning (few-shot examples)
- [ ] Past session context injection (recurring conditions, worsening pattern detection)

---

### Phase 3 — Intelligence + Scale

- [ ] Few-shot prompt improvement from confirmed doctor diagnoses
- [ ] Family profile context (child/elderly pathways)
- [ ] Chronic disease monitoring across sessions
- [ ] Proactive health alerts (regional outbreak + user risk profile match → push)
- [ ] Condition-specific LLM routing (mental health → dedicated prompt)
- [ ] Internal audit dashboard for escalation review

---

## 12. Technical Stack

| Component | Phase 1 | Phase 2+ |
|-----------|---------|---------|
| Symptom extraction | Dictionary (JS) + LLM fallback | LLM-only |
| Disease classification | LLM with structured JSON output | LLM + few-shot from confirmed cases |
| Severity classification | Hard rules + LLM | Same + full health form profile |
| Language detection | Script check + `franc` npm | LLM handles natively |
| Transliteration | Dictionary (JS) | LLM handles natively |
| Remedy retrieval | Pinecone vector search (seeded) | Same + allergen/safety filter |
| Response generation | LLM (Gemini Flash / GPT-4o-mini) | LLM + few-shot examples |
| Regional data | Pinecone index (static, one-time seed) | Live APIs (OpenAQ, IDSP) |
| Session storage | MongoDB (`DiagnosisSession`) | MongoDB |
| Cache | Redis (regional risk TTL 30d) | Redis |
| Vector DB | Pinecone `nova-medical` (remedies + regional-risk namespaces) | Same |
| Safety moderation | Regex Layer 1 + OpenAI Moderation API Layer 2 | Same |
| Follow-up trigger | Cron job (hourly poll) | FCM push notification |
| LLM provider | Gemini 1.5 Flash (FREE) / GPT-4o-mini (SILVER) | GPT-4o (GOLD) |

### LLM routing by tier (existing architecture)
```
FREE   → Gemini 1.5 Flash
SILVER → GPT-4o-mini
GOLD   → GPT-4o
Crisis → GPT-4o (always, regardless of tier)
```

### Why LLM over traditional ML models
Traditional ML (XGBoost, NER models) requires training data, model hosting, and a Python runtime. Instead:

- **Symptom extraction** — LLM with a structured JSON output prompt handles Hindi/English/Hinglish natively without a separate NER model
- **Disease classification** — LLM with `PriorRiskProfile` injected into context produces ranked differentials with reasoning, outperforming XGBoost at this scale
- **Severity classification** — hard rules (Stage 6) handle emergencies; LLM handles nuanced cases with full profile context
- **Remedy retrieval** — Pinecone vector search with Gemini embeddings. Full remedy data (ingredients, preparation, safety) lives in Pinecone metadata — no MongoDB lookup needed. Seeded once via a script.

Everything runs inside `services/chat` (Node.js). No separate ML service, no Python runtime.

---

*Each stage only proceeds when its checkpoint is cleared. No skipping. No assumptions carried forward without data.*
