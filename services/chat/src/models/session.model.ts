import mongoose, { Schema, Document } from 'mongoose';

// ─── Nested types ────────────────────────────────────────────────────────────

export interface ExtractedSymptom {
  name: string;
  originalText: string;
  bodyPart?: string;
  severityKeyword?: string;
  confidence: number;
}

export interface SymptomSet {
  chiefComplaint: string;
  symptoms: ExtractedSymptom[];
  duration?: { value: number; unit: 'hours' | 'days' | 'weeks' };
  pattern?: 'CONSTANT' | 'INTERMITTENT' | 'WORSENING' | 'IMPROVING';
  socrates: {
    site?: string;
    onset?: string;
    character?: string;
    radiation?: string;
    associated: string[];
    timing?: string;
    exacerbating: string[];
    relieving: string[];
    severity?: number;
  };
  functionalImpact: {
    eating?: boolean;
    sleeping?: boolean;
    working?: boolean;
  };
  medicationTaken?: string;
  redFlagsPresent: boolean;
  language: 'EN' | 'HI' | 'HINGLISH';
}

export interface RankedCondition {
  condition: string;
  score: number;
  reasons: string[];
}

export interface PriorRiskProfile {
  highRiskConditions: string[];
  ruledOut: string[];
  watchlist: RankedCondition[];
  drugSymptomFlags: string[];
  demographicFlags: string[];
  regionFlags: string[];
}

export interface RegionalRisk {
  city: string;
  country: string;
  month: number;
  endemic: string[];
  seasonal: string[];
  generatedAt: string;
}

export interface DifferentialResult {
  probableCauses: {
    condition: string;
    confidence: number;
    reasons: string[];
  }[];
  ruledOut: { condition: string; reason: string }[];
  flag?: 'GENERIC' | 'SEVERE';
  generatedAt: string;
}

export interface RemedyResult {
  nameEn: string;
  nameHi: string;
  preparationEn: string;
  preparationHi: string;
  ingredients: string[];
  source: string;
}

export interface LabTestRecommendation {
  testName: string;
  slug: string;
  reason: string;
  urgency: 'ROUTINE' | 'SOON' | 'URGENT';
}

export interface DiagnosisOutput {
  severity: 'LOW' | 'MODERATE' | 'HIGH' | 'EMERGENCY';
  probableCauses: {
    condition: string;
    confidence: number;
    explanation: string;
  }[];
  ruledOut: { condition: string; reason: string }[];
  action: 'SELF_CARE' | 'MONITOR' | 'VISIT_DOCTOR' | 'ER_NOW';
  actionDetail: string;
  homeRemedies: RemedyResult[];
  labTestsRecommended: LabTestRecommendation[];
  watchFor: string[];
  disclaimer: string;
  emergencyNumber?: string;
  language: 'EN' | 'HI' | 'HINGLISH';
}

export interface SessionMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface FollowUpResponse {
  answeredAt: string;
  outcome: 'IMPROVED' | 'SAME' | 'WORSENED' | 'SAW_DOCTOR';
  doctorDiagnosis?: string;
  notes?: string;
}

// ─── Main interface ───────────────────────────────────────────────────────────

export interface IDiagnosisSession extends Document {
  userId: string;
  profileId?: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ESCALATED' | 'ABANDONED';
  stage: number;

  // Profile snapshot at session start
  userProfile: {
    name: string;
    age: number;
    sex: string;
    heightCm?: number;
    weightKg?: number;
    bmi?: number;
    language: string;
    city?: string;
    conditions?: string[];
    medications?: { name: string; dosage: string }[];
    allergies?: { drugs: string[]; food: string[]; environmental: string[] };
  };

  // Pipeline state
  regionalRisk?: RegionalRisk;
  priorRiskProfile?: PriorRiskProfile;
  symptomSet?: SymptomSet;
  differentialDiagnosis?: DifferentialResult;
  output?: DiagnosisOutput;

  // Conversation
  messages: SessionMessage[];

  // Tracking
  questionCount: number;
  redFlagTriggered: boolean;
  escalationReason?: string;
  llmFailureCount: number;

  // Follow-up
  followUpResponse?: FollowUpResponse;

  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const SessionSchema = new Schema<IDiagnosisSession>(
  {
    userId:    { type: String, required: true, index: true },
    profileId: { type: String },
    status: {
      type: String,
      enum: ['IN_PROGRESS', 'COMPLETED', 'ESCALATED', 'ABANDONED'],
      default: 'IN_PROGRESS',
      index: true,
    },
    stage: { type: Number, default: 1 },

    userProfile: { type: Schema.Types.Mixed, required: true },

    regionalRisk:        { type: Schema.Types.Mixed },
    priorRiskProfile:    { type: Schema.Types.Mixed },
    symptomSet:          { type: Schema.Types.Mixed },
    differentialDiagnosis: { type: Schema.Types.Mixed },
    output:              { type: Schema.Types.Mixed },

    messages: [
      {
        role:      { type: String, enum: ['user', 'assistant'], required: true },
        content:   { type: String, required: true },
        timestamp: { type: String, required: true },
      },
    ],

    questionCount:    { type: Number, default: 0 },
    redFlagTriggered: { type: Boolean, default: false },
    escalationReason: { type: String },
    llmFailureCount:  { type: Number, default: 0 },

    followUpResponse:  { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
    collection: 'chat_sessions',
  },
);

// Compound index for active session lookup
SessionSchema.index({ userId: 1, status: 1 });


export const DiagnosisSession = mongoose.model<IDiagnosisSession>(
  'DiagnosisSession',
  SessionSchema,
);
