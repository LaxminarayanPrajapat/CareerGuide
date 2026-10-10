import { Router } from 'express';
import { z } from 'zod';

import authRouter from './auth.routes.js';
import * as auth from '../controllers/auth.controller.js';
import * as users from '../controllers/user.controller.js';
import * as questions from '../controllers/question.controller.js';
import * as assessments from '../controllers/assessment.controller.js';
import * as categories from '../controllers/category.controller.js';
import * as careers from '../controllers/career.controller.js';
import * as reports from '../controllers/report.controller.js';
import * as roadmaps from '../controllers/roadmap.controller.js';
import * as analytics from '../controllers/analytics.controller.js';
import * as settings from '../controllers/settings.controller.js';
import * as audit from '../controllers/audit.controller.js';

import { validate } from '../middleware/validate.js';
import { authenticate, requirePermission, requireRole } from '../middleware/auth.js';
import { aiLimiter } from '../middleware/rateLimit.js';
import {
  adminResetPasswordSchema,
  createUserSchema,
  idParamSchema,
  updateProfileSchema,
  updateUserSchema,
  updateUserStatusSchema,
} from '../schemas/user.schema.js';
import {
  assessmentCategoryCreateSchema,
  assessmentCategoryUpdateSchema,
  assessmentCreateSchema,
  assessmentListQuerySchema,
  assessmentStatusSchema,
  assessmentUpdateSchema,
  attemptListQuerySchema,
  createAttemptSchema,
  questionCreateSchema,
  questionListQuerySchema,
  questionUpdateSchema,
  saveAnswersSchema,
  submitAttemptSchema,
} from '../schemas/assessment.schema.js';
import {
  auditLogQuerySchema,
  careerCreateSchema,
  careerListQuerySchema,
  careerUpdateSchema,
  generateReportSchema,
  reportListQuerySchema,
  settingsUpdateSchema,
  skillCreateSchema,
  skillListQuerySchema,
  skillUpdateSchema,
  updateRoadmapItemSchema,
} from '../schemas/career.schema.js';

const router = Router();

const id = validate({ params: idParamSchema });
const query = (schema: z.ZodTypeAny) => validate({ query: schema });
const body = (schema: z.ZodTypeAny) => validate({ body: schema });
const activeFlag = body(z.object({ isActive: z.boolean() }));
const counsellorAssign = body(z.object({ counsellorId: z.string().regex(/^[a-fA-F0-9]{24}$/).nullable() }));

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------
router.get('/settings/public', settings.getPublicSettings);

// ---------------------------------------------------------------------------
// Authentication (self-contained: public + authenticated routes)
// ---------------------------------------------------------------------------
router.use('/auth', authRouter);

// ---------------------------------------------------------------------------
// Reference data readable by any authenticated user
// ---------------------------------------------------------------------------
router.get('/skills', authenticate, query(skillListQuerySchema), careers.listSkills);
router.get('/careers', authenticate, query(careerListQuerySchema), careers.listCareers);
router.get('/careers/:id', authenticate, id, careers.getCareer);
router.get('/assessment-categories', authenticate, assessments.listCategories);

// ---------------------------------------------------------------------------
// Candidate self-service
// ---------------------------------------------------------------------------
router.patch('/profile', authenticate, body(updateProfileSchema), auth.updateMyProfile);
router.get('/profile/skill-profile', authenticate, categories.getSkillProfile);

// ---------------------------------------------------------------------------
// Assessment catalogue and lifecycle
// ---------------------------------------------------------------------------
router.get('/assessments', authenticate, query(assessmentListQuerySchema), assessments.listAssessments);
router.get('/assessments/:id', authenticate, id, assessments.getAssessment);

router.get('/attempts/available', authenticate, requirePermission('attempts:take'), assessments.listAvailableAssessments);
router.post('/attempts', authenticate, requirePermission('attempts:take'), body(createAttemptSchema), assessments.startAttemptHandler);
router.get('/attempts/history', authenticate, requirePermission('attempts:read-own'), query(attemptListQuerySchema), assessments.attemptHistory);
router.get('/attempts/:id', authenticate, requirePermission('attempts:read-own'), id, assessments.getAttempt);
router.put('/attempts/:id/answers', authenticate, requirePermission('attempts:take'), id, body(saveAnswersSchema), assessments.putAnswers);
router.post('/attempts/:id/submit', authenticate, requirePermission('attempts:take'), id, body(submitAttemptSchema), assessments.submitAttempt);
router.get('/attempts/:id/result', authenticate, requirePermission('attempts:read-own'), id, assessments.getAttemptResult);

// ---------------------------------------------------------------------------
// Career compatibility (deterministic preview, no AI involved)
// ---------------------------------------------------------------------------
router.get('/compatibility', authenticate, careers.previewCompatibility);
router.get('/compatibility/:id', authenticate, id, careers.previewCompatibility);

// ---------------------------------------------------------------------------
// Reports and roadmaps
// ---------------------------------------------------------------------------
router.post('/reports/generate', authenticate, requirePermission('reports:generate-own'), aiLimiter, body(generateReportSchema), reports.generateReport);
router.get('/reports', authenticate, requirePermission('reports:read-own'), query(reportListQuerySchema), reports.listReports);
router.get('/reports/:id', authenticate, requirePermission('reports:read-own'), reports.getReport);
router.get('/reports/:id/download', authenticate, requirePermission('reports:read-own'), reports.downloadReport);

router.get('/roadmaps', authenticate, roadmaps.listRoadmaps);
router.get('/roadmaps/:id', authenticate, roadmaps.getRoadmap);
router.patch('/roadmaps/:id/items/:itemId', authenticate, requirePermission('roadmaps:manage-own'), body(updateRoadmapItemSchema), roadmaps.updateRoadmapItem);

// ---------------------------------------------------------------------------
// Analytics (each route checks its own permission)
// ---------------------------------------------------------------------------
router.get('/analytics/self', authenticate, requirePermission('analytics:self'), analytics.selfAnalytics);
router.get('/analytics/candidates/:id', authenticate, requirePermission('analytics:self'), id, analytics.candidateAnalytics);
router.get('/analytics/progression', authenticate, analytics.skillProgressionHandler);
router.get('/analytics/trend', authenticate, analytics.completionTrend);
router.get('/analytics/groups', authenticate, analytics.listGroups);
router.get('/analytics/students', authenticate, analytics.candidateDirectory);
router.get('/analytics/institution', authenticate, requirePermission('analytics:institution'), analytics.institutionAnalyticsHandler);
router.get('/analytics/counsellor', authenticate, requirePermission('analytics:assigned'), analytics.assignedAnalytics);
router.get('/analytics/system', authenticate, requirePermission('analytics:system'), analytics.systemAnalyticsHandler);
router.get('/exports/analytics.csv', authenticate, requirePermission('exports:download'), analytics.exportAnalyticsCsv);

// ---------------------------------------------------------------------------
// Question bank and test sets (counsellor + admin)
// ---------------------------------------------------------------------------
router.get('/questions', authenticate, requirePermission('questions:read'), query(questionListQuerySchema), questions.listQuestions);
router.get('/questions/:id', authenticate, requirePermission('questions:read'), id, questions.getQuestion);
router.post('/questions', authenticate, requirePermission('questions:write'), body(questionCreateSchema), questions.createQuestion);
router.patch('/questions/:id', authenticate, requirePermission('questions:write'), id, body(questionUpdateSchema), questions.updateQuestion);
router.delete('/questions/:id', authenticate, requirePermission('questions:delete'), id, questions.deleteQuestion);
router.patch('/questions/:id/status', authenticate, requirePermission('questions:write'), id, activeFlag, questions.setQuestionActive);

router.post('/assessments', authenticate, requirePermission('assessments:write'), body(assessmentCreateSchema), assessments.createAssessment);
router.patch('/assessments/:id', authenticate, requirePermission('assessments:write'), id, body(assessmentUpdateSchema), assessments.updateAssessment);
router.patch('/assessments/:id/status', authenticate, requirePermission('assessments:publish'), id, body(assessmentStatusSchema), assessments.setAssessmentStatus);
router.delete('/assessments/:id', authenticate, requirePermission('assessments:write'), id, assessments.deleteAssessment);

// ---------------------------------------------------------------------------
// Master data
// ---------------------------------------------------------------------------
router.post('/skills', authenticate, requirePermission('skills:write'), body(skillCreateSchema), careers.createSkill);
router.patch('/skills/:id', authenticate, requirePermission('skills:write'), id, body(skillUpdateSchema), careers.updateSkill);
router.delete('/skills/:id', authenticate, requirePermission('skills:write'), id, careers.deleteSkill);

router.post('/careers', authenticate, requirePermission('careers:write'), body(careerCreateSchema), careers.createCareer);
router.patch('/careers/:id', authenticate, requirePermission('careers:write'), id, body(careerUpdateSchema), careers.updateCareer);
router.delete('/careers/:id', authenticate, requirePermission('careers:write'), id, careers.deleteCareer);

router.get('/categories', authenticate, requirePermission('categories:read'), categories.listCategoriesAdmin);
router.post('/categories', authenticate, requirePermission('categories:write'), body(assessmentCategoryCreateSchema), categories.createCategory);
router.patch('/categories/:id', authenticate, requirePermission('categories:write'), id, body(assessmentCategoryUpdateSchema), categories.updateCategory);

// ---------------------------------------------------------------------------
// User administration
// ---------------------------------------------------------------------------
router.get('/users/permissions', authenticate, requirePermission('settings:read'), users.getPermissionMatrix);
router.get('/users', authenticate, requirePermission('users:read'), users.listUsers);
router.get('/users/:id', authenticate, requirePermission('users:read'), id, users.getUser);
router.post('/users', authenticate, requirePermission('users:write'), body(createUserSchema), users.createUser);
router.patch('/users/:id', authenticate, requirePermission('users:write'), id, body(updateUserSchema), users.updateUser);
router.patch('/users/:id/status', authenticate, requirePermission('users:manage-status'), id, body(updateUserStatusSchema), users.setUserStatus);
router.patch('/users/:id/counsellor', authenticate, requirePermission('users:write'), id, counsellorAssign, users.assignCounsellor);
router.post('/users/:id/reset-password', authenticate, requirePermission('users:manage-status'), id, body(adminResetPasswordSchema), users.adminResetPassword);

// ---------------------------------------------------------------------------
// Platform administration and audit
// ---------------------------------------------------------------------------
router.get('/settings', authenticate, requirePermission('settings:read'), settings.listSettings);
router.put('/settings', authenticate, requirePermission('settings:write'), body(settingsUpdateSchema), settings.updateSettings);
router.get('/audit-logs', authenticate, requirePermission('audit:read'), query(auditLogQuerySchema), audit.listAuditLogs);

// ---------------------------------------------------------------------------
// Supervisor views (ownership re-checked inside the controller)
// ---------------------------------------------------------------------------
router.get('/supervisor/attempts/:id', authenticate, requirePermission('attempts:read-all'), id, assessments.getAttemptForSupervisor);
router.use('/supervisor/reports', authenticate, requirePermission('reports:read-assigned'), reports.listReports);

export default router;
