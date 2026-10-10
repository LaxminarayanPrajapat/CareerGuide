import type { Request, Response } from 'express';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { AttemptModel } from '../models/Attempt.js';
import { UserModel } from '../models/User.js';
import { CareerModel } from '../models/Career.js';
import { QuestionModel } from '../models/Question.js';
import { AssessmentModel } from '../models/Assessment.js';
import { SkillModel } from '../models/Skill.js';
import { CareerReportModel } from '../models/CareerReport.js';
import { AuditLogModel } from '../models/auditLog.js';
import { escapeRegExp } from '../utils/pagination.js';
import {
  candidateDashboard,
  institutionAnalytics,
  counsellorAnalytics,
  systemAnalytics,
  skillProgression,
  attemptTrend,
} from '../services/analytics/analyticsService.js';

export const selfAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const data = await candidateDashboard(req.user!.id);
  return ok(res, data, 'Candidate analytics.');
});

export const candidateAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const candidateId = req.params.id;
  if (candidateId !== req.user!.id && !req.user!.permissions.includes('reports:read-assigned')) {
    throw ApiError.forbidden('You may only view your own analytics.');
  }
  const data = await candidateDashboard(candidateId);
  return ok(res, data, 'Candidate analytics.');
});

export const assignedAnalytics = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user!.permissions.includes('analytics:assigned') && !req.user!.permissions.includes('analytics:institution')) {
    throw ApiError.forbidden('You are not permitted to view batch analytics.');
  }
  const data = await counsellorAnalytics(req.user!.id, {
    batch: req.query.batch as string | undefined,
    department: req.query.department as string | undefined,
  });
  return ok(res, data, 'Batch analytics.');
});

export const institutionAnalyticsHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = await institutionAnalytics({
    batch: req.query.batch as string | undefined,
    department: req.query.department as string | undefined,
    includeCareerInterest: req.query.includeCareerInterest !== 'false',
  });
  return ok(res, data, 'Institutional analytics.');
});

export const systemAnalyticsHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = await systemAnalytics();
  return ok(res, data, 'System analytics.');
});

export const skillProgressionHandler = asyncHandler(async (req: Request, res: Response) => {
  const candidateId = req.query.candidateId
    ? String(req.query.candidateId)
    : req.user!.id;

  if (candidateId !== req.user!.id && !req.user!.permissions.includes('reports:read-assigned')) {
    throw ApiError.forbidden('You may only view your own skill progression.');
  }
  if (req.user!.role === 'counsellor' && candidateId !== req.user!.id) {
    const target = await UserModel.findById(candidateId).select('assignedCounsellor');
    if (!target?.assignedCounsellor || String(target.assignedCounsellor) !== req.user!.id) {
      throw ApiError.forbidden('This candidate is not assigned to you.');
    }
  }

  const data = await skillProgression(candidateId);
  return ok(res, data, 'Skill progression.');
});

export const completionTrend = asyncHandler(async (req: Request, res: Response) => {
  const months = Math.min(24, Math.max(1, Number(req.query.months ?? 12)));
  const data = await attemptTrend(months, req.query.batch as string | undefined);
  return ok(res, { trend: data }, 'Attempt completion trend.');
});

/**
 * CSV export. Reuses the same aggregation and scope rules as the on-screen
 * data, so exported data can never exceed what the user may see on screen.
 */
export const exportAnalyticsCsv = asyncHandler(async (req: Request, res: Response) => {
  const scope = req.user!.role;
  const header = ['metric', 'value'];
  let rows: Array<[string, string | number]>;

  const cell = (value: number | null | undefined): string | number => (value === null || value === undefined ? 'not available' : value);

  if (scope === 'management') {
    const data = await institutionAnalytics({});
    rows = [
      ['registered_students', data.summary.totalStudents],
      ['students_with_reports', data.summary.studentsWithReports],
      ['total_completed_assessments', data.summary.totalCompletedAssessments],
      ['overall_completion_rate_percent', cell(data.summary.overallCompletionRate)],
      ['overall_average_score_percent', cell(data.summary.overallAverageScore)],
      ['active_career_definitions', data.summary.activeCareers],
    ];
  } else {
    const data = await systemAnalytics();
    rows = [
      ['total_users', data.summary.totalUsers],
      ['active_users', data.summary.activeUsers],
      ['total_questions', data.summary.totalQuestions],
      ['published_assessments', data.summary.publishedAssessments],
      ['total_attempts', data.summary.totalAttempts],
      ['completed_attempts', data.summary.completedAttempts],
      ['live_attempts', data.summary.liveAttempts],
      ['total_reports', data.summary.totalReports],
      ['completion_rate_percent', cell(data.completionRate)],
    ];
  }

  const csv = [
    header.join(','),
    ...rows.map(([k, v]) => `${k},${String(v).replace(/"/g, '""')}`),
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="analytics-${scope}-${Date.now()}.csv"`);
  return res.send(csv);
});

/** Batches and departments present in the system, used to populate filters. */
export const listGroups = asyncHandler(async (req: Request, res: Response) => {
  const filter = req.user!.role === 'counsellor' ? { assignedCounsellor: req.user!.id } : {};
  const [batches, departments] = await Promise.all([
    UserModel.distinct('studentProfile.batch', { ...filter, 'studentProfile.batch': { $nin: ['', null] } }),
    UserModel.distinct('studentProfile.department', { ...filter, 'studentProfile.department': { $nin: ['', null] } }),
  ]);
  return ok(res, { batches: batches.filter(Boolean).sort(), departments: departments.filter(Boolean).sort() }, 'Groups.');
});

export const candidateDirectory = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user!.permissions.includes('analytics:assigned') && req.user!.role !== 'admin') {
    throw ApiError.forbidden('You are not permitted to browse the student directory.');
  }
  const search = req.query.search ? String(req.query.search) : '';
  const filter: Record<string, unknown> = { role: 'student' };
  if (req.user!.role === 'counsellor') filter.assignedCounsellor = req.user!.id;
  if (search) {
    const rx = { $regex: escapeRegExp(search), $options: 'i' };
    filter.$or = [{ fullName: rx }, { email: rx }];
  }
  const users = await UserModel.find(filter).select('fullName email studentProfile isActive lastLoginAt').limit(200).lean();
  return ok(res, { students: users }, 'Student directory.');
});
