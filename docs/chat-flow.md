# Nova Medical Agent — Full Chat Flow

**Version:** 1.0  
**Companion doc:** `medical-agent-pipeline.md`  
**Target:** Frontend engineers, backend engineers, QA

This document describes the complete end-to-end chat experience — from the moment a user taps "Check my symptoms" to the 48-hour follow-up. Every branch, every edge case, every background operation is covered.

---

## Table of Contents

1. [High-Level Flow](#1-high-level-flow)
2. [Act 1 — Session Initialization](#2-act-1--session-initialization)
3. [Act 2 — The Conversation (Stage 5)](#3-act-2--the-conversation-stage-5)
4. [Act 3 — Red Flag Path (Stage 6)](#4-act-3--red-flag-path-stage-6)
5. [Act 3 — Normal Path (Stages 7–8)](#5-act-3--normal-path-stages-78)
6. [Act 4 — Output (Stage 10)](#6-act-4--output-stage-10)
7. [Act 5 — Follow-up (Stage 11)](#7-act-5--follow-up-stage-11)
8. [Edge Cases](#8-edge-cases)
9. [Full Annotated Conversation Example](#9-full-annotated-conversation-example)

---

## 1. High-Level Flow

```
User taps "Check my symptoms"
  ↓
Session created
  ↓
Profile check (age + gender required, city used if available)
  ↓
[Background: Stages 2–4 fire in parallel]
  Stage 2 — Regional risk lookup (Pinecone → Redis cache)
  Stage 3 — Drug interaction check
  Stage 4 — Risk fusion → PriorRiskProfile (invisible prior built)
  ↓
Stage 5 — Conversation (max 7 questions, one at a time)
  │
  ├── Red flag detected (passive scan OR Block D) → Stage 6 → EMERGENCY output
  │
  └── No red flags → 7 questions done → Stage 7 (differential) → Stage 8 (lab tests)
                                              ↓
                                         Stage 9 — Safety guardrail
                                              ↓
                                         Stage 10 — Structured output shown
                                              ↓
                                         Stage 11 — Follow-up at 48hr
```

---

## 2. Act 1 — Session Initialization

**Trigger:** User taps "Check my symptoms"

**Frontend calls:**
```graphql
mutation StartSession: DiagnosisSession!
```

**Backend (< 200ms):**

1. Check: does user have an onboarding profile with at least `age` + `gender`?
   - No → block, return `requiresAction: COMPLETE_PROFILE` → redirect to profile setup
   - Yes → continue

2. Check: does an `IN_PROGRESS` session already exist for this user?
   - Yes → return existing session, frontend resumes from last stage
   - No → create new `DiagnosisSession`:
     ```
     status: IN_PROGRESS
     stage: 5
     messages: []
     questionCount: 0
     llmFailureCount: 0
     redFlagTriggered: false
     ```

3. Immediately fire **Stages 2–4 in background** — user sees "Getting things ready..." (~1–2s)

4. Return `sessionId` to frontend → user lands directly in conversation

---

### Background: Stages 2–4 (~1–2 seconds, parallel)

**Stage 2 — Regional Risk**
```
city: "Mumbai" (from user profile), month: 4 (April)
  ↓
Check Redis: "Mumbai:4" → miss
  ↓
Query Pinecone (namespace: regional-risk)
  ↓
Result: { endemic: ["Dengue", "Malaria"], seasonal: ["Heatstroke", "GI infections"] }
  ↓
Cache in Redis, TTL 30 days
```

If city not in profile → use India-wide fallback. Confidence noted as lower.

**Stage 3 — Drug Interaction Check**
- Profile has medications → run drug-symptom dictionary lookup
- Phase 1 (no medications in profile) → flag to ask in Block A
- Result stored in `PriorRiskProfile.drugSymptomFlags`

**Stage 4 — Risk Fusion**

Using: age 27, female, BMI 22, Mumbai, April

```
Demographic match (age/sex/BMI):  30% weight → young female, normal BMI
Regional match (Mumbai, April):   25% weight → Dengue, Malaria, GI
Conditions:                        not available (Phase 1)
Family history:                    not available (Phase 1)
Lifestyle:                         not available (Phase 1)
```

Output — `PriorRiskProfile` (never shown to user):
```
watchlist: [
  Dengue         0.40  (Mumbai + April + female demographic)
  Viral fever    0.35  (general seasonal)
  GI infection   0.30  (Mumbai + April)
  UTI            0.20  (female demographic)
  Malaria        0.15  (Mumbai endemic)
  Typhoid        0.12  (Mumbai + monsoon proximity)
  Heat exhaustion 0.10 (April heat)
]
```

This is the **invisible prior**. Every question from here is biased by it.

Session now at `stage: 5` — ready for conversation.

---

## 3. Act 2 — The Conversation (Stage 5)

Max **7 questions**, one at a time. Every user message goes through this pipeline before responding:

```
User message received
  ↓
[1] Passive red flag scan (regex, instant) — runs on EVERY message
    → match found → skip to Stage 6 immediately
  ↓
[2] LLM call:
    system prompt
    + serialized session state (stage, watchlist top 3, symptomSet so far, questions remaining)
    + last 4 messages (rolling window)
    + next block instruction
  ↓
[3] Extract structured data from LLM response
    → update symptomSet, questionCount, stage
    → append raw messages to session.messages[] (audit trail)
  ↓
[4] Safety guardrail (Layer 1 regex + Layer 2 OpenAI Moderation API)
  ↓
[5] Return response to user
```

---

### Block A — Chief Complaint (Q1–2)

```
Nova:   Hi Priya! I'm here to help. What's been bothering you the most?

User:   I have fever since yesterday and my whole body is aching
```
*Passive scan: clear*

LLM extracts: `chiefComplaint: "fever"`, `symptoms: [fever, body ache]`

No medications in profile → appends medication check:

```
Nova:   Got it — fever and body pain since yesterday.
        Are you currently taking any medicines regularly?

User:   No, nothing regularly
```

*questionCount: 2 — Block A done*

---

### Block B — Duration + Pattern (Q3)

```
Nova:   Is the fever constant, or does it come and go?

User:   It keeps coming and going, especially at night
```

LLM updates: `pattern: INTERMITTENT`, `duration: { value: 1, unit: "days" }`

*Intermittent fever, worse at night → Dengue and Malaria scores elevated in watchlist*

*questionCount: 3 — Block B done*

---

### Block C — SOCRATES, adaptive (Q4–5)

Watchlist has Dengue at top. `PriorRiskProfile` says: Mumbai + April + intermittent fever → prioritize dengue-specific questions.

```
Nova:   Do you have pain behind your eyes, or pain in your joints?

User:   Yes! My eyes are hurting a lot and my knees feel very heavy
```

*Retro-orbital pain + joint pain → Dengue probability spikes*

LLM updates `socrates.associated: ["retro-orbital pain", "joint pain"]`

*questionCount: 4*

```
Nova:   On a scale of 1 to 10, how severe would you say the overall discomfort is?

User:   Around 7
```

LLM updates `socrates.severity: 7`

*questionCount: 5 — Block C done*

---

### Block D — Red Flag Screen (Q6)

```
Nova:   One important question — are you experiencing any of these?
        • Difficulty breathing
        • Red spots or rash on skin
        • Bleeding from gums or nose
        • Extreme weakness or confusion

User:   Actually I have some red spots on my arms since this morning
```

*Passive scan fires: "red spots" + existing fever + joint pain → Dengue hemorrhagic pattern*

**Pipeline stops. Routes to Stage 6.**

---

> **If Block D was clear, conversation continues:**
>
> ### Block E — Functional Impact (Q6)
> ```
> Nova:   Are you able to eat, sleep, and do your daily activities normally?
>
> User:   Eating less, sleeping is very difficult because of the fever
> ```
> *questionCount: 6 — all blocks complete → proceed to scoring*
>
> **Q7 budget:** 1 question remaining, kept in reserve or used for any critical gap.
>
> After 7 questions → conclude regardless of remaining blocks. Lower confidence noted in output.

---

## 4. Act 3 — Red Flag Path (Stage 6)

Red flag triggered. Pipeline stops immediately.

**Backend:**
```
session.redFlagTriggered = true
session.escalationReason = "Petechial rash + fever + retro-orbital pain — Dengue hemorrhagic pattern"
session.status = "ESCALATED"
```

Skips Stages 7 and 8 entirely. Goes directly to Stage 9 (safety guardrail) → Stage 10 (output).

**Stage 9:** Both layers pass. `108` appended. Disclaimer appended.

**Output shown:**
```
⚠️  URGENT — Please see a doctor today

Your symptoms — fever, body pain, eye pain, joint pain, and red spots on skin —
may indicate Dengue fever, which can become serious quickly.

What to do: Visit a doctor or hospital today. Do not wait.

🚨 Go to ER immediately if:
   • Bleeding from gums or nose
   • Black or tarry stools
   • Sudden extreme weakness

📞 Emergency: 108

Tests to get before your visit:
• Dengue NS1 Antigen + CBC — get done today

⚠️ This is not a diagnosis. Only a doctor can confirm.
   Please seek medical attention now.
```

**Audit log:**
```
session_id, stage: 6, severity: HIGH, escalation_reason: "petechial_rash_fever_dengue_pattern"
```

---

## 5. Act 3 — Normal Path (Stages 7–8)

*No red flags. All 7 questions complete.*

User sees: "Analyzing your symptoms..." (~2–3 seconds)

### Stage 7 — Differential Scoring

Single LLM call with full context:

```
Patient:   27yo female, BMI 22, Mumbai, April
Symptoms:  fever (intermittent, 1 day), body ache, retro-orbital pain,
           joint pain, severity 7/10
Regional:  Dengue + Malaria endemic in Mumbai, April
Drug flags: none
Watchlist: Dengue 0.40, Viral fever 0.35, Malaria 0.30...
```

LLM returns structured JSON:
```json
{
  "probableCauses": [
    {
      "condition": "Dengue Fever",
      "confidence": 0.72,
      "reasons": ["retro-orbital pain", "joint pain", "intermittent fever", "Mumbai April endemic"]
    },
    {
      "condition": "Viral Fever",
      "confidence": 0.45,
      "reasons": ["fever pattern", "body ache", "short duration"]
    },
    {
      "condition": "Malaria",
      "confidence": 0.30,
      "reasons": ["Mumbai endemic", "intermittent fever pattern"]
    }
  ],
  "ruledOut": [
    { "condition": "UTI", "reason": "no urinary symptoms reported" },
    { "condition": "Typhoid", "reason": "duration too short, no GI symptoms" }
  ],
  "flag": null
}
```

**Safety adjustment:**
- Top confidence 0.72 → no downgrade needed
- Age 27, no comorbidities, no severity boosters
- Final severity: **MODERATE**

### Stage 8 — Lab Test Mapping

From differential top results:
- Dengue 0.72 → `NS1 Antigen`, `Dengue IgM`, `CBC`
- Malaria 0.30 → `Malarial Antigen`
- Severity MODERATE → recommend 1–2 targeted tests

Selected: **Dengue NS1 Antigen + CBC** (most urgent, most relevant)

---

## 6. Act 4 — Output (Stage 10)

**Stage 9 — Safety Guardrail:**
- Layer 1 (regex): no definitive diagnosis language, no medication names, disclaimer check → pass
- Layer 2 (OpenAI Moderation): no flags
- Disclaimer + watchFor appended

**Output shown to user:**

```
🟡  MODERATE

Most likely causes:

1. Dengue Fever  —  72% match
   Eye pain, joint pain, intermittent fever + Mumbai in April
   all point toward Dengue.

2. Viral Fever  —  45% match
   Fever pattern and body ache are consistent with
   a common viral infection.

3. Malaria  —  30% match
   Intermittent fever pattern in Mumbai is worth ruling out.

Ruled out:
• Typhoid — symptoms too early, no stomach issues
• UTI — no urinary symptoms

─────────────────────────────────────
Recommended action:
See a doctor if no improvement in 24 hours.

Home remedies:
• Adrak ki chai — 2–3 times daily
• Papaya leaf juice — traditional remedy for Dengue
• Stay hydrated — ORS if sweating heavily

Lab tests before your visit:
• Dengue NS1 Antigen — get done today (given your location)
• CBC — checks platelet count, important for Dengue

Watch for these warning signs:
• Red spots or rash on skin → see doctor the same day
• Fever above 103°F
• Bleeding from gums or nose → ER immediately (108)
─────────────────────────────────────

⚠️ This is for guidance only and is not a substitute for
   professional medical advice. Please consult a qualified
   doctor for diagnosis and treatment.
```

**Backend:**
```
session.status = "COMPLETED"
session.output = DiagnosisOutput { ... }
session.followUpScheduled = now + 48hr
```

---

## 7. Act 5 — Follow-up (Stage 11)

**Trigger mechanism:** Cron job runs every hour. Finds sessions where:
```
status = 'COMPLETED'
AND followUpScheduled <= now
AND followUpResponse IS NULL
```

**Phase 1 — in-app card** (shown on next app open before any new session):

```
┌─────────────────────────────────────────────┐
│  Two days ago you told us about             │
│  fever and body pain.                       │
│                                             │
│  How are you feeling now?                   │
│                                             │
│  [ Much better ]   [ About the same ]       │
│  [ Got worse ]     [ Saw a doctor ]         │
└─────────────────────────────────────────────┘
```

**Frontend calls:**
```graphql
mutation SubmitFollowUp($sessionId: ID!, $outcome: FollowUpOutcome!, $doctorDiagnosis: String)
```

---

### Follow-up outcomes

**IMPROVED:**
```
Nova:  So glad you're feeling better! Take care. 🙏
```
`session.status` stays `COMPLETED`. No further action.

---

**SAW_DOCTOR:**
```
Nova:  Glad you got checked. What did the doctor say? (optional)

User:  Doctor confirmed Dengue, on treatment now
```
`FollowUpResponse.doctorDiagnosis = "Dengue confirmed"` → stored as future training signal (Phase 3).

---

**SAME:**
```
Nova:  If you haven't seen a doctor yet, we'd recommend visiting one today.
       Your symptoms have lasted 3 days now — it's worth getting checked.
```

---

**WORSENED:**
```
Nova:  I'm sorry to hear that. Let's look at this again.
       Last time you had fever, eye pain, and joint pain.
       Has anything new come up since then?
```
Session re-opened → Stage 5, previous `SymptomSet` injected as context.
`session.status = "IN_PROGRESS"`, `session.stage = 5`

---

**No response in 72hr:**
Session auto-marked `COMPLETED`. User not prompted again.

---

## 8. Edge Cases

| Scenario | What happens |
|----------|-------------|
| **User types "I want to end my life"** | Passive scan fires instantly, pipeline overridden, crisis resources shown (`iCall: 9152987821`, `Vandrevala: 1860-2662-345`), session flagged for audit |
| **LLM call times out (15s)** | Retry ×2 with exponential backoff → stage fallback response → session stays `IN_PROGRESS` → retried on next message |
| **3 consecutive LLM failures** | `status: ABANDONED`, user shown: "Something went wrong. Please try again in a few minutes." |
| **User drops off mid-conversation** | Session stays `IN_PROGRESS`. On return → last 4 messages give natural re-entry → "Last time you told me about fever. Want to continue?" |
| **Profile incomplete (no DOB/gender)** | Blocked — redirected to complete profile before chat starts |
| **City not in profile** | India-wide fallback for regional risk — lower confidence communicated in output |
| **LLM returns invalid JSON (Stage 7)** | Retry once → if fails → `flag: GENERIC`, severity `MODERATE`, "recommend seeing a doctor" |
| **OpenAI Moderation API down** | Layer 1 (regex) still runs. Response shown with disclaimer. Outage logged for alerting. |
| **User switches language mid-chat** | LLM detects language shift → switches response language → maintains new language for rest of session |
| **Returning user, same symptoms** | Past sessions checked → if same condition → flagged as "recurring" → severity bumped one level |

---

## 9. Full Annotated Conversation Example

```
[SESSION CREATED]
[BACKGROUND: Mumbai April → Dengue 0.40, Viral 0.35, Malaria 0.30 watchlist built]

Nova:   Hi Priya! I'm here to help. What's been bothering you the most?
                                               [Block A, Q1]

User:   I have fever since yesterday and my whole body is aching

        [Extracted: chiefComplaint=fever, symptoms=[fever, body ache]]
        [Passive scan: clear]
        [Medication check appended — no meds in profile]

Nova:   Got it — fever and body pain since yesterday.
        Are you currently taking any medicines regularly?
                                               [Block A, Q2]

User:   No, nothing regularly

        [drugSymptomFlags: none]

Nova:   Is the fever constant, or does it come and go?
                                               [Block B, Q3]

User:   Keeps coming and going, especially at night

        [pattern=INTERMITTENT, duration=1 day]
        [Dengue + Malaria scores elevated]

Nova:   Do you have pain behind your eyes, or pain in your joints?
                                               [Block C, Q4 — dengue-biased]

User:   Yes! My eyes are hurting a lot and my knees feel very heavy

        [socrates.associated=[retro-orbital pain, joint pain]]
        [Dengue confidence rises significantly]

Nova:   On a scale of 1 to 10, how severe is the overall discomfort?
                                               [Block C, Q5]

User:   Around 7

        [socrates.severity=7]

Nova:   One important question — are you experiencing any of these?
        • Difficulty breathing
        • Red spots or rash on skin
        • Bleeding from gums or nose
        • Extreme weakness or confusion
                                               [Block D, Q6]

User:   Actually I have some red spots on my arms since this morning

        [Passive scan: MATCH — rash + fever + joint pain]
        [→ STAGE 6: ESCALATED]

Nova:   ⚠️ URGENT — Please see a doctor today.

        Your symptoms — fever, body pain, eye pain, joint pain,
        and red spots on skin — may indicate Dengue fever,
        which can become serious quickly.

        Go to ER immediately if you feel extreme weakness,
        bleeding from gums, or black stools.

        📞 Emergency: 108

        Tests to get before your visit:
        • Dengue NS1 Antigen + CBC — get done today

        ⚠️ This is not a diagnosis. Please seek medical attention now.

[SESSION: ESCALATED]
[AUDIT: session_id, stage=6, severity=HIGH, reason=petechial_rash_dengue_pattern]

--- 48 hours later ---

[CRON: followUpScheduled threshold reached]
[IN-APP CARD SHOWN on next open]

Nova:   Two days ago you told us about fever and body pain.
        How are you feeling now?
        [ Much better ] [ Same ] [ Got worse ] [ Saw a doctor ]

User:   Saw a doctor

Nova:   Glad you got checked. What did the doctor say? (optional)

User:   Confirmed Dengue, on treatment

        [FollowUpResponse.outcome=SAW_DOCTOR]
        [FollowUpResponse.doctorDiagnosis="Dengue confirmed"]
        [Session COMPLETED — stored as training signal]
```

---

*This flow is implemented entirely within `services/chat` (Node.js). No Python runtime, no separate ML service.*  
*Full pipeline architecture: see `medical-agent-pipeline.md`*
