import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { ATTEMPT_STATUSES, type AttemptStatus } from '../config/constants.js';

export interface AttemptSection {
  skill: Schema.Types.ObjectId;
  skillName: string;
  skillCode: string;
  marksObtained: number;
  marksPossible: number;
  /** Normalised 0..100 contribution of this attempt to the skill. */
  normalisedScore: number;
  evidenceCount: number;
}

export interface AttemptSkillResult {
  skill: Schema.Types.ObjectId;
  skillName: string;
  skillCode: string;
  marksObtained: number;
  marksPossible: number;
  score: number;
  /** Number of questions that produced a usable measurement. */
  evidenceCount: number;
}

export interface PreferenceResult {
  dimension: string;
  rawPoints: number;
  maxPoints: number;
  normalisedScore: number;
  itemsAnswered: number;
}

export interface AttemptDocumentFields {
  candidate: Schema.Types.ObjectId;
  assessment: Schema.Types.ObjectId;
  assessmentTitle: string;
  assessmentCategory: string;
  status: AttemptStatus;
  /** Server-authoritative clock. */
  startedAt: Date;
  expiresAt: Date;
  submittedAt?: Date;
  /** Snapshot of the randomised question order chosen when the attempt started. */
  questionOrder: Schema.Types.ObjectId[];
  /** Per-question randomised option order chosen when the attempt started. */
  optionOrders: Record<string, string[]>;
  durationMinutes: number;
  totalQuestions: number;
  marksPerQuestion: number;
  totalMarks: number;
  score: number;
  marksObtained: number;
  /** Marks actually used as the scoring denominator after the test-validation rule. */
  scorableMarks: number;
  percentage: number;
  passed?: boolean;
  answeredCount: number;
  flaggedCount: number;
  isFlagged: boolean;
  /** Items excluded from scoring by the test-validation rule. */
  invalidQuestionIds: Schema.Types.ObjectId[];
  skillResults: AttemptSkillResult[];
  preferenceResults: PreferenceResult[];
  /** Personality items answered - kept as evidence, not as right/wrong. */
  personalityResponses: Array<{ question: Schema.Types.ObjectId; dimension?: string; optionId?: string }>;
  timeSpentSeconds: number;
  lastSavedAt?: Date;
  evaluatedAt?: Date;
  submissionReason?: 'manual' | 'time_expired' | 'admin';
  ipAddress?: string;
  userAgent?: string;
}

const attemptSkillResultSchema = new Schema<AttemptSkillResult>(
  {
    skill: { type: Schema.Types.ObjectId, ref: 'Skill', required: true },
    skillName: String,
    skillCode: String,
    marksObtained: { type: Number, default: 0 },
    marksPossible: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    evidenceCount: { type: Number, default: 0 },
  },
  { _id: false },
);

const preferenceResultSchema = new Schema<PreferenceResult>(
  {
    dimension: { type: String, required: true },
    rawPoints: { type: Number, default: 0 },
    maxPoints: { type: Number, default: 0 },
    normalisedScore: { type: Number, default: 0 },
    itemsAnswered: { type: Number, default: 0 },
  },
  { _id: false },
);

const personalityResponseSchema = new Schema(
  {
    question: { type: Schema.Types.ObjectId, ref: 'Question', required: true },
    dimension: String,
    optionId: String,
  },
  { _id: false },
);

const attemptSchema = new Schema<AttemptDocumentFields>(
  {
    candidate: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    assessment: { type: Schema.Types.ObjectId, ref: 'Assessment', required: true, index: true },
    assessmentTitle: { type: String, required: true },
    assessmentCategory: { type: String, required: true, index: true },
    status: { type: String, enum: ATTEMPT_STATUSES, default: 'in_progress', index: true },
    startedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true, index: true },
    submittedAt: { type: Date },
    questionOrder: { type: [Schema.Types.ObjectId], required: true },
    optionOrders: { type: Map, of: [String], default: () => new Map() },
    durationMinutes: { type: Number, required: true },
    totalQuestions: { type: Number, required: true },
    marksPerQuestion: { type: Number, required: true },
    totalMarks: { type: Number, required: true },
    score: { type: Number, default: 0 },
    marksObtained: { type: Number, default: 0 },
    scorableMarks: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    passed: { type: Boolean },
    answeredCount: { type: Number, default: 0 },
    flaggedCount: { type: Number, default: 0 },
    isFlagged: { type: Boolean, default: false },
    invalidQuestionIds: { type: [Schema.Types.ObjectId], default: [] },
    skillResults: { type: [attemptSkillResultSchema], default: [] },
    preferenceResults: { type: [preferenceResultSchema], default: [] },
    personalityResponses: { type: [personalityResponseSchema], default: [] },
    timeSpentSeconds: { type: Number, default: 0 },
    lastSavedAt: { type: Date },
    evaluatedAt: { type: Date },
    submissionReason: { type: String, enum: ['manual', 'time_expired', 'admin'] },
    ipAddress: { type: String },
    userAgent: { type: String, maxlength: 300 },
  },
  { timestamps: true },
);

attemptSchema.index({ candidate: 1, assessment: 1, status: 1 });
attemptSchema.index({ candidate: 1, createdAt: -1 });
attemptSchema.index({ status: 1, expiresAt: 1 });

/** Only one live attempt per candidate per assessment at a time. */
attemptSchema.index(
  { candidate: 1, assessment: 1 },
  { unique: true, partialFilterExpression: { status: 'in_progress' }, name: 'one_live_attempt' },
);

export type Attempt = InferSchemaType<AttemptDocumentFields>;
export type AttemptDocument = HydratedDocument<AttemptDocumentFields>;
export const AttemptModel = model<AttemptDocumentFields>('Attempt', attemptSchema);
