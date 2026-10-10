import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export interface CompatibilityEvidence {
  requirementIndex: number;
  skillCode: string;
  skillName: string;
  importance: 'core' | 'supporting';
  requiredLevel: number;
  measuredLevel: number;
  weight: number;
  /** 'measured' when the candidate has evidence, 'unmeasured' otherwise. */
  state: 'measured' | 'unmeasured';
  /** positive when the candidate meets or exceeds the requirement. */
  gap: number;
  ratio: number;
  note: string;
}

export interface CareerRecommendationItem {
  career: Schema.Types.ObjectId;
  careerSlug: string;
  careerTitle: string;
  careerCategory: string;
  /** 0..100. Indicative compatibility, not a success probability. */
  compatibilityScore: number;
  confidence: 'low' | 'moderate' | 'good';
  dataCoverage: number;
  skillFitScore: number;
  aptitudeFitScore: number;
  preferenceFitScore: number;
  evidence: CompatibilityEvidence[];
  /** Deterministic, template-safe explanation used when AI is unavailable. */
  deterministicSummary: string;
  aiExplanation?: string;
  topGaps: Array<{ skillCode: string; skillName: string; gap: number; priority: 'high' | 'medium' | 'low' }>;
}

export interface CareerReportDocumentFields {
  candidate: Schema.Types.ObjectId;
  reportNumber: string;
  scoringVersion: string;
  inputAttemptIds: Schema.Types.ObjectId[];
  inputAssessments: Array<{ assessment: Schema.Types.ObjectId; title: string; category: string; percentage: number }>;
  skillProfileRevision: number;
  dataCoverage: number;
  completedAssessments: number;
  skillSnapshot: Array<{ skill: Schema.Types.ObjectId; skillCode: string; skillName: string; score: number; evidence: number }>;
  strongestSkills: Array<{ skillCode: string; skillName: string; score: number }>;
  weakestSkills: Array<{ skillCode: string; skillName: string; score: number }>;
  unmeasuredSkillCodes: string[];
  recommendations: CareerRecommendationItem[];
  preferenceProfile: Array<{ dimension: string; score: number; itemsAnswered: number }>;
  aiNarrative?: AiNarrative;
  generationStatus: 'pending' | 'completed' | 'failed';
  aiProviderUsed: string;
  aiFailureReason?: string;
  aiLatencyMs?: number;
  disclaimer: string;
  generatedAt: Date;
  generatedBy: Schema.Types.ObjectId;
  isSample: boolean;
}

export interface AiNarrative {
  overview: string;
  strengths: string[];
  developmentAreas: string[];
  careerRationale: Record<string, string>;
  roadmapGuidance: Record<string, string[]>;
  motivationNotes: string[];
}

const aiNarrativeSchema = new Schema<AiNarrative>(
  {
    overview: { type: String, default: '' },
    strengths: { type: [String], default: [] },
    developmentAreas: { type: [String], default: [] },
    careerRationale: { type: Map, of: String, default: () => new Map() },
    roadmapGuidance: { type: Map, of: [String], default: () => new Map() },
    motivationNotes: { type: [String], default: [] },
  },
  { _id: false },
);

const evidenceSchema = new Schema<CompatibilityEvidence>(
  {
    requirementIndex: Number,
    skillCode: String,
    skillName: String,
    importance: String,
    requiredLevel: Number,
    measuredLevel: { type: Number, default: 0 },
    weight: Number,
    state: { type: String, enum: ['measured', 'unmeasured'] },
    gap: Number,
    ratio: { type: Number, default: 0 },
    note: String,
  },
  { _id: false },
);

const recommendationSchema = new Schema<CareerRecommendationItem>(
  {
    career: { type: Schema.Types.ObjectId, ref: 'Career', required: true, index: true },
    careerSlug: String,
    careerTitle: String,
    careerCategory: String,
    compatibilityScore: { type: Number, min: 0, max: 100, required: true },
    confidence: { type: String, enum: ['low', 'moderate', 'good'], default: 'low' },
    dataCoverage: { type: Number, min: 0, max: 1, default: 0 },
    skillFitScore: { type: Number, default: 0 },
    aptitudeFitScore: { type: Number, default: 0 },
    preferenceFitScore: { type: Number, default: 0 },
    evidence: { type: [evidenceSchema], default: [] },
    deterministicSummary: { type: String, default: '' },
    aiExplanation: { type: String, default: undefined },
    topGaps: {
      type: [
        new Schema(
          {
            skillCode: String,
            skillName: String,
            gap: Number,
            priority: { type: String, enum: ['high', 'medium', 'low'] },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { _id: false },
);

const careerReportSchema = new Schema<CareerReportDocumentFields>(
  {
    candidate: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reportNumber: { type: String, required: true, unique: true },
    scoringVersion: { type: String, required: true },
    inputAttemptIds: { type: [Schema.Types.ObjectId], default: [] },
    inputAssessments: {
      type: [
        new Schema(
          {
            assessment: { type: Schema.Types.ObjectId, ref: 'Assessment' },
            title: String,
            category: String,
            percentage: Number,
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    skillProfileRevision: { type: Number, default: 1 },
    dataCoverage: { type: Number, min: 0, max: 1, default: 0 },
    completedAssessments: { type: Number, default: 0 },
    skillSnapshot: {
      type: [
        new Schema(
          {
            skill: { type: Schema.Types.ObjectId, ref: 'Skill' },
            skillCode: String,
            skillName: String,
            score: Number,
            evidence: Number,
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    strongestSkills: {
      type: [
        new Schema(
          { skillCode: String, skillName: String, score: Number },
          { _id: false },
        ),
      ],
      default: [],
    },
    weakestSkills: {
      type: [
        new Schema(
          { skillCode: String, skillName: String, score: Number },
          { _id: false },
        ),
      ],
      default: [],
    },
    unmeasuredSkillCodes: { type: [String], default: [] },
    recommendations: { type: [recommendationSchema], default: [] },
    preferenceProfile: {
      type: [
        new Schema(
          { dimension: String, score: Number, itemsAnswered: Number },
          { _id: false },
        ),
      ],
      default: [],
    },
    aiNarrative: { type: aiNarrativeSchema, default: undefined },
    generationStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    aiProviderUsed: { type: String, default: 'none' },
    aiFailureReason: { type: String },
    aiLatencyMs: { type: Number },
    disclaimer: { type: String, required: true },
    generatedAt: { type: Date, default: () => new Date() },
    generatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isSample: { type: Boolean, default: false },
  },
  { timestamps: true },
);

careerReportSchema.index({ candidate: 1, generatedAt: -1 });

export type CareerReport = InferSchemaType<CareerReportDocumentFields>;
export type CareerReportDocument = HydratedDocument<CareerReportDocumentFields>;
export const CareerReportModel = model<CareerReportDocumentFields>('CareerReport', careerReportSchema);
