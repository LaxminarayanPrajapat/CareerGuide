import { z } from 'zod';

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Must be a valid identifier.');

const requirementSchema = z.object({
  skill: objectId,
  requiredLevel: z.coerce.number().min(0).max(100).default(50),
  weight: z.coerce.number().min(0.01).max(1).default(1),
  importance: z.enum(['core', 'supporting']).default('core'),
  developmentFocus: z.string().trim().max(300).optional(),
});

const fitSchema = z.object({
  dimension: z.string().trim().min(2).max(60),
  weight: z.coerce.number().min(0).max(1).default(1),
});

export const skillCreateSchema = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_]+$/, 'Use letters, digits and underscores only.'),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(10).max(1000),
  category: z.enum(['aptitude', 'technical', 'domain', 'professional', 'communication']),
  isPreferenceSkill: z.boolean().default(false),
  measurementUnit: z.string().trim().max(40).default('percent'),
  isActive: z.boolean().default(true),
  tags: z.array(z.string().trim().max(40)).max(15).default([]),
});

export const skillUpdateSchema = skillCreateSchema.partial();

export const skillListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  category: z.enum(['aptitude', 'technical', 'domain', 'professional', 'communication']).optional(),
  isActive: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => v === true || v === 'true')
    .optional(),
  search: z.string().trim().max(120).optional(),
});

export const careerCreateSchema = z
  .object({
    title: z.string().trim().min(3).max(140),
    category: z.string().trim().min(2).max(80),
    description: z.string().trim().min(20).max(3000),
    responsibilities: z.array(z.string().trim().min(3).max(400)).max(15).default([]),
    requiredSkills: z.array(requirementSchema).min(1, 'Define at least one required skill.').max(30),
    aptitudeFit: z.array(fitSchema).max(10).default([]),
    preferenceFit: z.array(fitSchema).max(10).default([]),
    prerequisites: z.array(z.string().trim().min(3).max(300)).max(15).default([]),
    learningStages: z
      .array(
        z.object({
          stage: z.string().trim().min(2).max(60),
          focus: z.array(z.string().trim().min(3).max(300)).max(10).default([]),
        }),
      )
      .max(6)
      .default([]),
    relatedCareers: z.array(objectId).max(10).default([]),
    suggestedProjects: z.array(z.string().trim().min(3).max(400)).max(12).default([]),
    isActive: z.boolean().default(true),
    reviewNote: z.string().trim().max(500).optional(),
  })
  .superRefine((value, ctx) => {
    const ids = value.requiredSkills.map((r) => r.skill);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A skill may only appear once in the requirement list.',
        path: ['requiredSkills'],
      });
    }
  });

export const careerUpdateSchema = careerCreateSchema
  .innerType()
  .omit({ requiredSkills: true })
  .partial()
  .extend({ requiredSkills: z.array(requirementSchema).min(1).max(30).optional() });

export const careerListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  category: z.string().trim().max(80).optional(),
  isActive: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => v === true || v === 'true')
    .optional(),
  search: z.string().trim().max(120).optional(),
  minScore: z.coerce.number().min(0).max(100).optional(),
});

export const generateReportSchema = z.object({
  candidateId: objectId.optional(),
  includeRoadmaps: z.boolean().default(true),
  roadmapCount: z.coerce.number().int().min(0).max(5).default(3),
  forceRegenerate: z.boolean().default(false),
});

export const reportListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  candidateId: objectId.optional(),
});

export const updateRoadmapItemSchema = z.object({
  status: z.enum(['not_started', 'in_progress', 'completed']),
});

export const settingsUpdateSchema = z.record(z.string().min(1).max(80), z.unknown());

export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  category: z.enum(['auth', 'access', 'admin', 'assessment', 'report', 'system', 'security']).optional(),
  action: z.string().trim().max(80).optional(),
  outcome: z.enum(['success', 'failure', 'denied']).optional(),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  search: z.string().trim().max(120).optional(),
});

export type SkillCreateInput = z.infer<typeof skillCreateSchema>;
export type SkillUpdateInput = z.infer<typeof skillUpdateSchema>;
export type CareerCreateInput = z.infer<typeof careerCreateSchema>;
export type GenerateReportInput = z.infer<typeof generateReportSchema>;
