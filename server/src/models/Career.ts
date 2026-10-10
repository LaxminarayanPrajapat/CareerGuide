import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export interface CareerRequirement {
  skill: Schema.Types.ObjectId;
  skillCode: string;
  skillName: string;
  /** Required competency level, 0..100, on the same scale as measured skill scores. */
  requiredLevel: number;
  /** Relative importance within the career, 0..1. Weights are normalised at scoring time. */
  weight: number;
  importance: 'core' | 'supporting';
  /** How a low score here is interpreted in the written explanation. */
  developmentFocus: string;
}

export interface CareerDocumentFields {
  slug: string;
  title: string;
  category: string;
  description: string;
  responsibilities: string[];
  requiredSkills: CareerRequirement[];
  /** Aptitude dimensions that matter for the role, 0..1 weight each. */
  aptitudeFit: Array<{ dimension: string; weight: number }>;
  /** Working preferences that suit the role, 0..1 weight each. */
  preferenceFit: Array<{ dimension: string; weight: number }>;
  prerequisites: string[];
  learningStages: Array<{ stage: string; focus: string[] }>;
  relatedCareers: Schema.Types.ObjectId[];
  suggestedProjects: string[];
  isActive: boolean;
  isSample: boolean;
  reviewNote: string;
  sourceNote: string;
}

const requirementSchema = new Schema<CareerRequirement>(
  {
    skill: { type: Schema.Types.ObjectId, ref: 'Skill', required: true },
    skillCode: String,
    skillName: String,
    requiredLevel: { type: Number, min: 0, max: 100, default: 50 },
    weight: { type: Number, min: 0.01, max: 1, default: 1 },
    importance: { type: String, enum: ['core', 'supporting'], default: 'core' },
    developmentFocus: { type: String, maxlength: 300, default: '' },
  },
  { _id: false },
);

const fitSchema = new Schema<{ dimension: string; weight: number }>(
  {
    dimension: { type: String, required: true, maxlength: 60 },
    weight: { type: Number, min: 0, max: 1, default: 1 },
  },
  { _id: false },
);

const stageSchema = new Schema<{ stage: string; focus: string[] }>(
  {
    stage: { type: String, required: true, maxlength: 60 },
    focus: { type: [String], default: [] },
  },
  { _id: false },
);

const careerSchema = new Schema<CareerDocumentFields>(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    title: { type: String, required: true, unique: true, trim: true, maxlength: 140 },
    category: { type: String, required: true, trim: true, maxlength: 80, index: true },
    description: { type: String, required: true, trim: true, maxlength: 3000 },
    responsibilities: { type: [String], default: [] },
    requiredSkills: { type: [requirementSchema], default: [] },
    aptitudeFit: { type: [fitSchema], default: [] },
    preferenceFit: { type: [fitSchema], default: [] },
    prerequisites: { type: [String], default: [] },
    learningStages: { type: [stageSchema], default: [] },
    relatedCareers: { type: [Schema.Types.ObjectId], default: [] },
    suggestedProjects: { type: [String], default: [] },
    isActive: { type: Boolean, default: true, index: true },
    isSample: { type: Boolean, default: false },
    reviewNote: { type: String, maxlength: 500, default: '' },
    sourceNote: {
      type: String,
      maxlength: 500,
      default:
        'Sample catalogue entry created for academic demonstration. Not an exhaustive or ranked list of careers.',
    },
  },
  { timestamps: true },
);

careerSchema.index({ title: 'text', description: 'text' });
careerSchema.index({ category: 1, isActive: 1 });

export type Career = InferSchemaType<CareerDocumentFields>;
export type CareerDocument = HydratedDocument<CareerDocumentFields>;
export const CareerModel = model<CareerDocumentFields>('Career', careerSchema);
