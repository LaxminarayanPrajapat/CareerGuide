import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export interface SkillDocumentFields {
  code: string;
  name: string;
  description: string;
  category: 'aptitude' | 'technical' | 'domain' | 'professional' | 'communication';
  /** Preference skills are derived from the personality instrument, not from right/wrong answers. */
  isPreferenceSkill: boolean;
  measurementUnit: string;
  isActive: boolean;
  tags: string[];
  isSample: boolean;
}

const skillSchema = new Schema<SkillDocumentFields>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 40 },
    name: { type: String, required: true, unique: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    category: {
      type: String,
      required: true,
      enum: ['aptitude', 'technical', 'domain', 'professional', 'communication'],
      index: true,
    },
    isPreferenceSkill: { type: Boolean, default: false },
    measurementUnit: { type: String, default: 'percent', maxlength: 40 },
    isActive: { type: Boolean, default: true, index: true },
    tags: { type: [String], default: [], index: true },
    isSample: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export type Skill = InferSchemaType<SkillDocumentFields>;
export type SkillDocument = HydratedDocument<SkillDocumentFields>;
export const SkillModel = model<SkillDocumentFields>('Skill', skillSchema);
