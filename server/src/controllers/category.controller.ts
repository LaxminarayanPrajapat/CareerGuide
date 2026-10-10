import type { Request, Response } from 'express';
import { AssessmentCategoryModel } from '../models/AssessmentCategory.js';
import { AttemptModel } from '../models/Attempt.js';
import { CandidateSkillProfileModel, SkillProfileRevisionModel } from '../models/CandidateSkillProfile.js';
import { QuestionModel } from '../models/Question.js';
import { UserModel } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { created, ok } from '../utils/response.js';
import { recordAudit, auditFromRequest } from '../services/audit/auditService.js';

export const listCategoriesAdmin = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await AssessmentCategoryModel.find().sort({ displayOrder: 1 }).lean();
  const [questionCounts, attemptCounts] = await Promise.all([
    Promise.all(
      categories.map(async (c) => ({
        key: c.key,
        count: await QuestionModel.countDocuments({ category: c.key }),
      })),
    ),
    Promise.all(
      categories.map(async (c) => ({
        key: c.key,
        count: await AttemptModel.countDocuments({ assessmentCategory: c.key }),
      })),
    ),
  ]);

  return ok(
    res,
    {
      categories: categories.map((c) => ({
        ...c,
        id: String(c._id),
        questionCount: questionCounts.find((q) => q.key === c.key)?.count ?? 0,
        attemptCount: attemptCounts.find((a) => a.key === c.key)?.count ?? 0,
      })),
    },
    'Assessment categories.',
  );
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const existing = await AssessmentCategoryModel.findOne({ key: req.body.key });
  if (existing) throw ApiError.conflict('A category with this key already exists.');

  const category = await AssessmentCategoryModel.create({ ...req.body, isSample: false });
  await recordAudit(
    auditFromRequest(req, {
      action: 'category.create',
      category: 'admin',
      targetType: 'AssessmentCategory',
      targetId: String(category._id),
      message: `Created assessment category "${category.name}".`,
      metadata: { category: category.key },
    }),
  );
  return created(res, { category }, 'Category created.');
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await AssessmentCategoryModel.findById(req.params.id);
  if (!category) throw ApiError.notFound('Category not found.');
  Object.assign(category, req.body);
  await category.save();

  await recordAudit(
    auditFromRequest(req, {
      action: 'category.update',
      category: 'admin',
      targetType: 'AssessmentCategory',
      targetId: String(category._id),
      message: `Updated assessment category "${category.name}".`,
    }),
  );
  return ok(res, { category }, 'Category updated.');
});

/** Read-only view of the candidate's structured skill profile. */
export const getSkillProfile = asyncHandler(async (req: Request, res: Response) => {
  const targetId = req.query.candidateId ? String(req.query.candidateId) : req.user!.id;

  if (targetId !== req.user!.id) {
    if (!req.user!.permissions.includes('profile:read-assigned')) {
      throw ApiError.forbidden('You may only view your own skill profile.');
    }
    if (req.user!.role === 'counsellor') {
      const target = await UserModel.findById(targetId).select('assignedCounsellor');
      if (!target?.assignedCounsellor || String(target.assignedCounsellor) !== req.user!.id) {
        throw ApiError.forbidden('This candidate is not assigned to you.');
      }
    }
  }

  const [profile, revisions] = await Promise.all([
    CandidateSkillProfileModel.findOne({ candidate: targetId }).lean(),
    SkillProfileRevisionModel.find({ candidate: targetId })
      .sort({ revision: -1 })
      .limit(20)
      .select('revision reason catalogueCoverage createdAt')
      .lean(),
  ]);

  if (!profile) {
    return ok(
      res,
      { empty: true, measurements: [], revisions: [], message: 'No assessments have been completed yet, so no skill profile exists.' },
      'Skill profile.',
    );
  }

  const measurements = [...profile.measurements].sort((a, b) => b.score - a.score);

  return ok(
    res,
    {
      empty: false,
      candidateId: String(profile.candidate),
      revision: profile.revision,
      catalogueCoverage: profile.catalogueCoverage,
      totalCompletedAssessments: profile.totalCompletedAssessments,
      lastUpdatedAt: profile.lastUpdatedAt,
      measurements: measurements.map((m) => ({
        skillId: String(m.skill),
        code: m.skillCode,
        name: m.skillName,
        category: m.category,
        score: m.score,
        evidence: m.evidence,
        observations: m.observations,
        lastUpdatedAt: m.lastUpdatedAt,
      })),
      revisions: revisions.map((r) => ({
        revision: r.revision,
        reason: r.reason,
        coverage: r.catalogueCoverage,
        at: r.createdAt,
      })),
    },
    'Skill profile.',
  );
});
