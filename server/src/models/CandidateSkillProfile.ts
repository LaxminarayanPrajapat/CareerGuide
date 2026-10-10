import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export interface SkillMeasurement {
  skill: Schema.Types.ObjectId;
  skillCode: string;
  skillName: string;
  category: string;
  /** Current measured level, 0..100. */
  score: number;
  /** Weighted amount of evidence behind the current level. */
  evidence: number;
  /** Number of distinct completed assessments that contributed. */
  observations: number;
  lastUpdatedAt: Date;
  history: Array<{
    attempt: Schema.Types.ObjectId;
    assessment: Schema.Types.ObjectId;
    assessmentTitle: string;
    score: number;
    gainedEvidence: number;
    at: Date;
  }>;
}

export interface CandidateSkillProfileDocumentFields {
  candidate: Schema.Types.ObjectId;
  measurements: SkillMeasurement[];
  revision: number;
  lastUpdatedAt: Date;
  /** Aggregate coverage: share of the active skill catalogue with evidence. */
  catalogueCoverage: number;
  totalCompletedAssessments: number;
}

const measurementSchema = new Schema<SkillMeasurement>(
  {
    skill: { type: Schema.Types.ObjectId, ref: 'Skill', required: true },
    skillCode: String,
    skillName: String,
    category: String,
    score: { type: Number, min: 0, max: 100, default: 0 },
    evidence: { type: Number, min: 0, default: 0 },
    observations: { type: Number, min: 0, default: 0 },
    lastUpdatedAt: { type: Date, default: () => new Date() },
    history: {
      type: [
        new Schema(
          {
            attempt: { type: Schema.Types.ObjectId, ref: 'Attempt' },
            assessment: { type: Schema.Types.ObjectId, ref: 'Assessment' },
            assessmentTitle: String,
            score: Number,
            gainedEvidence: Number,
            at: { type: Date, default: () => new Date() },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { _id: false },
);

const candidateSkillProfileSchema = new Schema<CandidateSkillProfileDocumentFields>(
  {
    candidate: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    measurements: { type: [measurementSchema], default: [] },
    revision: { type: Number, default: 1 },
    lastUpdatedAt: { type: Date, default: () => new Date() },
    catalogueCoverage: { type: Number, min: 0, max: 1, default: 0 },
    totalCompletedAssessments: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export type CandidateSkillProfile = InferSchemaType<CandidateSkillProfileDocumentFields>;
export type CandidateSkillProfileDocument = HydratedDocument<CandidateSkillProfileDocumentFields>;
export const CandidateSkillProfileModel = model<CandidateSkillProfileDocumentFields>(
  'CandidateSkillProfile',
  candidateSkillProfileSchema,
);

/**
 * Immutable snapshot of the profile after each update, so skill progression can
 * be reconstructed without overwriting history.
 */
export interface SkillProfileRevisionDocumentFields {
  candidate: Schema.Types.ObjectId;
  revision: number;
  triggerAttempt?: Schema.Types.ObjectId;
  triggerAssessment?: Schema.Types.ObjectId;
  reason: string;
  snapshot: Array<{
    skill: Schema.Types.ObjectId;
    skillCode: string;
    skillName: string;
    score: number;
    evidence: number;
    observations: number;
  }>;
  catalogueCoverage: number;
  createdAt?: Date;
}

const revisionSchema = new Schema<SkillProfileRevisionDocumentFields>(
  {
    candidate: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    revision: { type: Number, required: true },
    triggerAttempt: { type: Schema.Types.ObjectId, ref: 'Attempt' },
    triggerAssessment: { type: Schema.Types.ObjectId, ref: 'Assessment' },
    reason: { type: String, required: true, maxlength: 200 },
    snapshot: {
      type: [
        new Schema(
          {
            skill: { type: Schema.Types.ObjectId, ref: 'Skill', required: true },
            skillCode: String,
            skillName: String,
            score: Number,
            evidence: Number,
            observations: Number,
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    catalogueCoverage: { type: Number, default: 0 },
  },
  { timestamps: true },
);

revisionSchema.index({ candidate: 1, revision: -1 });
revisionSchema.index({ candidate: 1, revision: 1 }, { unique: true });

export type SkillProfileRevisionDocument = HydratedDocument<SkillProfileRevisionDocumentFields>;
export const SkillProfileRevisionModel = model<SkillProfileRevisionDocumentFields>(
  'SkillProfileRevision',
  revisionSchema,
);
