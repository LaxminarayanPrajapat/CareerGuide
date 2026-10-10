import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { ASSESSMENT_CATEGORIES, type AssessmentCategory } from '../config/constants.js';

export interface AssessmentCategoryDocumentFields {
  key: AssessmentCategory;
  name: string;
  description: string;
  color: string;
  icon: string;
  scoringModel: 'objective' | 'preference';
  isActive: boolean;
  displayOrder: number;
  isSample: boolean;
}

const assessmentCategorySchema = new Schema<AssessmentCategoryDocumentFields>(
  {
    key: { type: String, required: true, unique: true, enum: ASSESSMENT_CATEGORIES },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    color: { type: String, default: '#2563eb', maxlength: 20 },
    icon: { type: String, default: 'Target', maxlength: 40 },
    scoringModel: { type: String, enum: ['objective', 'preference'], default: 'objective' },
    isActive: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
    isSample: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export type AssessmentCategoryDocument = HydratedDocument<AssessmentCategoryDocumentFields>;
export const AssessmentCategoryModel = model<AssessmentCategoryDocumentFields>(
  'AssessmentCategory',
  assessmentCategorySchema,
);
