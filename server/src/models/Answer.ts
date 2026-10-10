import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export interface AnswerDocumentFields {
  attempt: Schema.Types.ObjectId;
  question: Schema.Types.ObjectId;
  candidate: Schema.Types.ObjectId;
  assessment: Schema.Types.ObjectId;
  /** Randomised display index used for this question in this attempt. */
  displayIndex: number;
  selectedOptionId?: string;
  /** For free numeric/short responses; kept for forward compatibility. */
  responseText?: string;
  isFlagged: boolean;
  isAnswered: boolean;
  marksPossible: number;
  /** Server-computed award. Never sent to the candidate before submission. */
  marksAwarded?: number;
  isCorrect?: boolean;
  /** 'scored' | 'preference' | 'invalid' | 'unanswered' */
  evaluationStatus: 'scored' | 'preference' | 'invalid' | 'unanswered';
  invalidReason?: string;
  skillContributions: Array<{ skill: Schema.Types.ObjectId; marksObtained: number; marksPossible: number }>;
  preferenceContribution?: { dimension: string; points: number; maxPoints: number };
  savedAt: Date;
  submittedAt?: Date;
}

const answerSchema = new Schema<AnswerDocumentFields>(
  {
    attempt: { type: Schema.Types.ObjectId, ref: 'Attempt', required: true, index: true },
    question: { type: Schema.Types.ObjectId, ref: 'Question', required: true, index: true },
    candidate: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    assessment: { type: Schema.Types.ObjectId, ref: 'Assessment', required: true },
    displayIndex: { type: Number, required: true },
    selectedOptionId: { type: String, default: undefined },
    responseText: { type: String, maxlength: 2000, default: undefined },
    isFlagged: { type: Boolean, default: false },
    isAnswered: { type: Boolean, default: false },
    marksPossible: { type: Number, default: 0 },
    marksAwarded: { type: Number, default: undefined },
    isCorrect: { type: Boolean, default: undefined },
    evaluationStatus: {
      type: String,
      enum: ['scored', 'preference', 'invalid', 'unanswered'],
      default: 'unanswered',
    },
    invalidReason: { type: String, default: undefined },
    skillContributions: {
      type: [
        new Schema(
          {
            skill: { type: Schema.Types.ObjectId, ref: 'Skill', required: true },
            marksObtained: { type: Number, default: 0 },
            marksPossible: { type: Number, default: 0 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    preferenceContribution: {
      type: new Schema(
        {
          dimension: { type: String, required: true },
          points: { type: Number, default: 0 },
          maxPoints: { type: Number, default: 0 },
        },
        { _id: false },
      ),
      default: undefined,
    },
    savedAt: { type: Date, default: () => new Date() },
    submittedAt: { type: Date },
  },
  { timestamps: true },
);

answerSchema.index({ attempt: 1, displayIndex: 1 }, { unique: true });
answerSchema.index({ attempt: 1, question: 1 }, { unique: true });
answerSchema.index({ candidate: 1, createdAt: -1 });

export type Answer = InferSchemaType<AnswerDocumentFields>;
export type AnswerDocument = HydratedDocument<AnswerDocumentFields>;
export const AnswerModel = model<AnswerDocumentFields>('Answer', answerSchema);
