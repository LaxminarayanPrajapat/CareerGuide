import { z } from 'zod';
import {
  ASSESSMENT_CATEGORIES,
  DIFFICULTY_LEVELS,
  PREFERENCE_DIMENSIONS,
} from '../config/constants.js';

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Must be a valid identifier.');

export const assessmentCategoryCreateSchema = z.object({
  key: z.enum(ASSESSMENT_CATEGORIES),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().min(10).max(1000),
  color: z.string().trim().max(20).default('#2563eb'),
  icon: z.string().trim().max(40).default('Target'),
  scoringModel: z.enum(['objective', 'preference']).default('objective'),
  isActive: z.boolean().default(true),
  displayOrder: z.coerce.number().int().min(0).max(99).default(0),
});

export const assessmentCategoryUpdateSchema = assessmentCategoryCreateSchema
  .omit({ key: true })
  .partial();

const optionSchema = z.object({
  optionId: z.string().trim().min(1).max(20),
  text: z.string().trim().min(1).max(1000),
  preferencePoints: z.coerce.number().min(-5).max(5).optional(),
});

export const questionCreateSchema = z
  .object({
    text: z.string().trim().min(5).max(4000),
    category: z.enum(ASSESSMENT_CATEGORIES),
    topic: z.string().trim().min(2).max(120),
    questionType: z.enum(['mcq', 'likert']).default('mcq'),
    options: z.array(optionSchema).max(8).default([]),
    correctOptionId: z.string().trim().max(20).optional(),
    preferenceDimension: z.enum(PREFERENCE_DIMENSIONS).optional(),
    scaleMin: z.coerce.number().int().min(1).max(10).optional(),
    scaleMax: z.coerce.number().int().min(1).max(10).optional(),
    explanation: z.string().trim().max(2000).optional(),
    difficulty: z.enum(DIFFICULTY_LEVELS).default('medium'),
    skillMappings: z
      .array(
        z.object({
          skill: objectId,
          weight: z.coerce.number().min(0.01).max(1).default(1),
        }),
      )
      .max(10)
      .default([]),
    marks: z.coerce.number().min(0.1).max(100).default(1),
    isActive: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    const optionIds = value.options.map((o) => o.optionId);
    if (new Set(optionIds).size !== optionIds.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Option identifiers must be unique.', path: ['options'] });
    }
    if (value.questionType === 'mcq') {
      if (value.options.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'A multiple-choice item needs at least two options.',
          path: ['options'],
        });
      }
      if (!value.correctOptionId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'A multiple-choice item must declare a correct answer.',
          path: ['correctOptionId'],
        });
      } else if (value.options.length > 0 && !optionIds.includes(value.correctOptionId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'The correct answer must match one of the supplied options.',
          path: ['correctOptionId'],
        });
      }
      if (value.preferenceDimension) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Objective items cannot declare a preference dimension.',
          path: ['preferenceDimension'],
        });
      }
    } else {
      if (!value.preferenceDimension) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'A preference item must declare the dimension it contributes to.',
          path: ['preferenceDimension'],
        });
      }
      if (!value.scaleMin || !value.scaleMax) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'A preference item must declare its response scale bounds.',
          path: ['scaleMin'],
        });
      } else if (value.scaleMax <= value.scaleMin) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Scale maximum must be greater than the minimum.',
          path: ['scaleMax'],
        });
      }
      if (value.options.some((o) => o.preferencePoints === undefined)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Every scale option must define preferencePoints.',
          path: ['options'],
        });
      }
    }
  });

export const questionUpdateSchema = questionCreateSchema.innerType().partial();

export const questionListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.enum(ASSESSMENT_CATEGORIES).optional(),
  difficulty: z.enum(DIFFICULTY_LEVELS).optional(),
  questionType: z.enum(['mcq', 'likert']).optional(),
  isActive: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => v === true || v === 'true')
    .optional(),
  skill: objectId.optional(),
  search: z.string().trim().max(120).optional(),
});

export const assessmentCreateSchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    description: z.string().trim().min(10).max(2000),
    instructions: z.string().trim().min(10).max(4000),
    category: z.enum(ASSESSMENT_CATEGORIES),
    questionPool: z.array(objectId).min(1, 'Select at least one question.').max(500),
    questionCount: z.coerce.number().int().min(1).max(200),
    durationMinutes: z.coerce.number().int().min(1).max(600),
    marksPerQuestion: z.coerce.number().min(0.1).max(100),
    passingPercentage: z.coerce.number().min(0).max(100).default(40),
    shuffleQuestions: z.boolean().default(true),
    shuffleOptions: z.boolean().default(true),
    shuffleAtAttempt: z.boolean().default(true),
    maxAttempts: z.coerce.number().int().min(1).max(20).default(2),
    status: z.enum(['draft', 'published', 'archived']).default('draft'),
    availableFrom: z.coerce.date().optional(),
    availableUntil: z.coerce.date().optional(),
    assignedBatches: z.array(z.string().trim().max(60)).max(50).default([]),
    scoringNote: z.string().trim().max(1000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.questionCount > value.questionPool.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Question count cannot exceed the size of the selected question pool.',
        path: ['questionCount'],
      });
    }
    if (value.availableFrom && value.availableUntil && value.availableUntil <= value.availableFrom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Availability end must be after the start.',
        path: ['availableUntil'],
      });
    }
  });

export const assessmentUpdateSchema = z
  .object({    title: z.string().trim().min(3).max(160).optional(),
    description: z.string().trim().min(10).max(2000).optional(),
    instructions: z.string().trim().min(10).max(4000).optional(),
    category: z.enum(ASSESSMENT_CATEGORIES).optional(),
    questionPool: z.array(objectId).min(1).max(500).optional(),
    questionCount: z.coerce.number().int().min(1).max(200).optional(),
    durationMinutes: z.coerce.number().int().min(1).max(600).optional(),
    marksPerQuestion: z.coerce.number().min(0.1).max(100).optional(),
    passingPercentage: z.coerce.number().min(0).max(100).optional(),
    shuffleQuestions: z.boolean().optional(),
    shuffleOptions: z.boolean().optional(),
    shuffleAtAttempt: z.boolean().optional(),
    maxAttempts: z.coerce.number().int().min(1).max(20).optional(),
    status: z.enum(['draft', 'published', 'archived']).optional(),
    availableFrom: z.coerce.date().nullable().optional(),
    availableUntil: z.coerce.date().nullable().optional(),
    assignedBatches: z.array(z.string().trim().max(60)).max(50).optional(),
    scoringNote: z.string().trim().max(1000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Provide at least one field to update.' });

export const assessmentStatusSchema = z.object({
  status: z.enum(['draft', 'published', 'archived']),
});

export const assessmentListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.enum(ASSESSMENT_CATEGORIES).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  search: z.string().trim().max(120).optional(),
  includeArchived: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => v === true || v === 'true')
    .optional(),
});

export const createAttemptSchema = z.object({
  assessmentId: objectId,
});

export const saveAnswersSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: objectId,
        selectedOptionId: z.string().trim().max(20).optional(),
        isFlagged: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(200),
});

export const submitAttemptSchema = z.object({
  confirm: z.boolean().default(true),
});

export const attemptListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['in_progress', 'submitted', 'auto_submitted', 'expired']).optional(),
  category: z.enum(ASSESSMENT_CATEGORIES).optional(),
  candidateId: objectId.optional(),
  search: z.string().trim().max(120).optional(),
});

export type QuestionCreateInput = z.infer<typeof questionCreateSchema>;
export type AssessmentCreateInput = z.infer<typeof assessmentCreateSchema>;
export type SaveAnswersInput = z.infer<typeof saveAnswersSchema>;
