import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import {
  ASSESSMENT_CATEGORIES,
  DIFFICULTY_LEVELS,
  PREFERENCE_DIMENSIONS,
  type AssessmentCategory,
  type Difficulty,
} from '../config/constants.js';

export interface QuestionOption {
  optionId: string;
  text: string;
  /** Likert points contributed to a preference dimension (personality items only). */
  preferencePoints?: number;
}

export interface QuestionDocumentFields {
  text: string;
  category: AssessmentCategory;
  topic: string;
  questionType: 'mcq' | 'likert';
  options: QuestionOption[];
  /** Objectively scored items: id of the correct option. */
  correctOptionId?: string;
  /** Personality items: dimension that the response contributes to. */
  preferenceDimension?: string;
  /** Scale bounds advertised to the candidate (personality instrument). */
  scaleMin?: number;
  scaleMax?: number;
  explanation?: string;
  difficulty: Difficulty;
  /** Each mapping is one measurement of one structured skill. */
  skillMappings: Array<{ skill: Schema.Types.ObjectId; weight: number }>;
  marks: number;
  isActive: boolean;
  isSample: boolean;
  author: Schema.Types.ObjectId;
  updatedBy?: Schema.Types.ObjectId;
  usageCount: number;
}

const optionSchema = new Schema<QuestionOption>(
  {
    optionId: { type: String, required: true, maxlength: 20 },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
    preferencePoints: { type: Number, min: -5, max: 5 },
  },
  { _id: false },
);

const questionSchema = new Schema<QuestionDocumentFields>(
  {
    text: { type: String, required: true, trim: true, minlength: 5, maxlength: 4000 },
    category: { type: String, required: true, enum: ASSESSMENT_CATEGORIES, index: true },
    topic: { type: String, required: true, trim: true, maxlength: 120, index: true },
    questionType: { type: String, required: true, enum: ['mcq', 'likert'], default: 'mcq' },
    options: { type: [optionSchema], default: [] },
    correctOptionId: { type: String, default: undefined },
    preferenceDimension: { type: String, enum: PREFERENCE_DIMENSIONS, default: undefined },
    scaleMin: { type: Number, min: 1, max: 10, default: undefined },
    scaleMax: { type: Number, min: 1, max: 10, default: undefined },
    explanation: { type: String, trim: true, maxlength: 2000 },
    difficulty: { type: String, enum: DIFFICULTY_LEVELS, default: 'medium', index: true },
    skillMappings: {
      type: [
        new Schema(
          {
            skill: { type: Schema.Types.ObjectId, ref: 'Skill', required: true },
            weight: { type: Number, min: 0.01, max: 1, default: 1 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    marks: { type: Number, min: 0, max: 100, default: 1 },
    isActive: { type: Boolean, default: true, index: true },
    isSample: { type: Boolean, default: false },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    usageCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

questionSchema.index({ category: 1, isActive: 1, difficulty: 1 });
questionSchema.index({ text: 'text', topic: 'text' });
questionSchema.index({ category: 1, skillMappings: 1 });

/**
 * Test-validation rule used when a test set is saved and again at scoring time.
 * A malformed item is flagged and excluded - the system never invents an
 * answer key for it.
 */
export function evaluateQuestionScorability(question: {
  questionType: string;
  options: { optionId: string }[];
  correctOptionId?: string;
  preferenceDimension?: string;
  marks: number;
}): { scorable: boolean; reason?: string } {
  if (question.marks <= 0) return { scorable: false, reason: 'Item carries no marks.' };
  if (question.questionType === 'mcq') {
    if (question.options.length < 2) {
      return { scorable: false, reason: 'Multiple-choice item needs at least two options.' };
    }
    if (!question.correctOptionId) {
      return { scorable: false, reason: 'Multiple-choice item has no answer key.' };
    }
    if (!question.options.some((o) => o.optionId === question.correctOptionId)) {
      return { scorable: false, reason: 'Answer key does not match any option.' };
    }
    return { scorable: true };
  }
  if (!question.preferenceDimension) {
    return { scorable: false, reason: 'Preference item has no declared dimension.' };
  }
  return { scorable: true };
}

export type Question = InferSchemaType<QuestionDocumentFields>;
export type QuestionDocument = HydratedDocument<QuestionDocumentFields>;
export const QuestionModel = model<QuestionDocumentFields>('Question', questionSchema);
