import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { ASSESSMENT_CATEGORIES, type AssessmentCategory } from '../config/constants.js';

export interface AssessmentDocumentFields {
  title: string;
  description: string;
  instructions: string;
  category: AssessmentCategory;
  /** Question pool. At attempt creation a random subset is drawn from this pool. */
  questionPool: Schema.Types.ObjectId[];
  questionCount: number;
  durationMinutes: number;
  marksPerQuestion: number;
  totalMarks: number;
  passingPercentage: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  shuffleAtAttempt: boolean;
  maxAttempts: number;
  status: 'draft' | 'published' | 'archived';
  availableFrom?: Date;
  availableUntil?: Date;
  assignedBatches: string[];
  createdBy: Schema.Types.ObjectId;
  updatedBy?: Schema.Types.ObjectId;
  isSample: boolean;
  scoringNote: string;
  /** Denormalised counter kept in step with completed attempts. */
  attemptCount: number;
}

const assessmentSchema = new Schema<AssessmentDocumentFields>(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    instructions: { type: String, required: true, trim: true, maxlength: 4000 },
    category: { type: String, required: true, enum: ASSESSMENT_CATEGORIES, index: true },
    questionPool: { type: [Schema.Types.ObjectId], default: [], index: true },
    questionCount: { type: Number, required: true, min: 1, max: 200 },
    durationMinutes: { type: Number, required: true, min: 1, max: 600 },
    marksPerQuestion: { type: Number, required: true, min: 0.1, max: 100 },
    totalMarks: { type: Number, required: true, min: 1 },
    passingPercentage: { type: Number, min: 0, max: 100, default: 40 },
    shuffleQuestions: { type: Boolean, default: true },
    shuffleOptions: { type: Boolean, default: true },
    shuffleAtAttempt: { type: Boolean, default: true },
    maxAttempts: { type: Number, min: 1, max: 20, default: 2 },
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },
    availableFrom: { type: Date },
    availableUntil: { type: Date },
    assignedBatches: { type: [String], default: [], index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isSample: { type: Boolean, default: false },
    scoringNote: { type: String, trim: true, maxlength: 1000 },
    attemptCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

assessmentSchema.index({ status: 1, category: 1 });
assessmentSchema.index({ title: 'text' });

export type Assessment = InferSchemaType<AssessmentDocumentFields>;
export type AssessmentDocument = HydratedDocument<AssessmentDocumentFields>;
export const AssessmentModel = model<AssessmentDocumentFields>('Assessment', assessmentSchema);
