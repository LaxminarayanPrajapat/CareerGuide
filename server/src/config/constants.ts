/**
 * Application-wide enumerations.
 *
 * These values are persisted in MongoDB, so changing them requires a data
 * migration. They are intentionally duplicated (as string literal unions) in
 * `src/types/express.d.ts` only where the compiler needs them.
 */

export const ROLES = ['admin', 'counsellor', 'management', 'student'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  // user administration
  'users:read',
  'users:write',
  'users:manage-role',
  'users:manage-status',
  // master data
  'careers:read',
  'careers:write',
  'skills:read',
  'skills:write',
  'categories:read',
  'categories:write',
  // assessment authoring
  'questions:read',
  'questions:write',
  'questions:delete',
  'assessments:read',
  'assessments:write',
  'assessments:publish',
  // candidate activity
  'attempts:take',
  'attempts:read-own',
  'attempts:read-all',
  'profile:read-own',
  'profile:write-own',
  'profile:read-assigned',
  'profile:read-any',
  'reports:generate-own',
  'reports:read-own',
  'reports:read-assigned',
  'reports:read-any',
  'roadmaps:manage-own',
  // analytics
  'analytics:self',
  'analytics:assigned',
  'analytics:institution',
  'analytics:system',
  'exports:download',
  // platform
  'settings:read',
  'settings:write',
  'ai:configure',
  'audit:read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/**
 * Server-side permission matrix. This is the single source of truth for
 * authorisation - the frontend only mirrors it for hiding UI affordances.
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [...PERMISSIONS],
  counsellor: [
    'careers:read',
    'skills:read',
    'categories:read',
    'questions:read',
    'questions:write',
    'assessments:read',
    'assessments:write',
    'profile:read-assigned',
    'reports:read-assigned',
    'attempts:read-all',
    'analytics:assigned',
    'exports:download',
    'profile:read-own',
    // Read-only directory access, hard-scoped to the counsellor's own students
    // by the list query in user.controller.ts.
    'users:read',
  ],
  management: [
    'careers:read',
    'skills:read',
    'categories:read',
    'questions:read',
    'assessments:read',
    'users:read',
    'analytics:institution',
    'exports:download',
    'profile:read-own',
  ],
  student: [
    'careers:read',
    'skills:read',
    'categories:read',
    'questions:read',
    'assessments:read',
    'attempts:take',
    'attempts:read-own',
    'profile:read-own',
    'profile:write-own',
    'reports:generate-own',
    'reports:read-own',
    'roadmaps:manage-own',
    'analytics:self',
  ],
};

export const ASSESSMENT_CATEGORIES = [
  'aptitude',
  'logical_reasoning',
  'technical_knowledge',
  'domain_knowledge',
  'personality',
] as const;
export type AssessmentCategory = (typeof ASSESSMENT_CATEGORIES)[number];

export const QUESTION_TYPES = ['mcq', 'likert'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const DIFFICULTY_LEVELS = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTY_LEVELS)[number];

export const SKILL_CATEGORIES = [
  'aptitude',
  'technical',
  'domain',
  'professional',
  'communication',
] as const;
export type SkillCategory = (typeof SKILL_CATEGORIES)[number];

export const ATTEMPT_STATUSES = ['in_progress', 'submitted', 'auto_submitted', 'expired'] as const;
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

export const REPORT_STATUSES = ['pending', 'completed', 'failed'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const ROADMAP_ITEM_STATUSES = ['not_started', 'in_progress', 'completed'] as const;
export type RoadmapItemStatus = (typeof ROADMAP_ITEM_STATUSES)[number];

/** Version of the deterministic career compatibility algorithm. */
export const COMPATIBILITY_SCORING_VERSION = 'compatibility-v1.0.0';

/**
 * Personality / work-preference dimensions. These are indicative working
 * preferences only - they are NOT clinical or diagnostic personality types.
 */
export const PREFERENCE_DIMENSIONS = [
  'analytical',
  'creative',
  'structured',
  'collaborative',
  'leadership',
  'detail_oriented',
  'exploratory',
] as const;
export type PreferenceDimension = (typeof PREFERENCE_DIMENSIONS)[number];
