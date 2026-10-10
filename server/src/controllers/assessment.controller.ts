import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { AssessmentModel } from '../models/Assessment.js';
import { AssessmentCategoryModel } from '../models/AssessmentCategory.js';
import { AttemptModel } from '../models/Attempt.js';
import { QuestionModel, evaluateQuestionScorability } from '../models/Question.js';
import { UserModel } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { created, ok, paginationMeta } from '../utils/response.js';
import { escapeRegExp } from '../utils/pagination.js';
import { recordAudit, auditFromRequest } from '../services/audit/auditService.js';
import {
  buildAttemptPayload,
  buildResultPayload,
  finaliseAttempt,
  isAssessmentAvailable,
  loadAttemptForCandidate,
  saveAnswers,
  startAttempt,
} from '../services/assessments/attemptService.js';
import type {
  AssessmentCreateInput,
  SaveAnswersInput,
} from '../schemas/assessment.schema.js';

/** Strips internal pool/author fields from the catalogue view shown to candidates. */
function publicAssessment(doc: Record<string, unknown>) {
  return {
    id: String(doc._id),
    title: doc.title,
    description: doc.description,
    instructions: doc.instructions,
    category: doc.category,
    questionCount: doc.questionCount,
    durationMinutes: doc.durationMinutes,
    marksPerQuestion: doc.marksPerQuestion,
    totalMarks: doc.totalMarks,
    passingPercentage: doc.passingPercentage,
    maxAttempts: doc.maxAttempts,
    status: doc.status,
    availableFrom: doc.availableFrom ?? null,
    availableUntil: doc.availableUntil ?? null,
    scoringNote: doc.scoringNote ?? '',
    attemptCount: doc.attemptCount ?? 0,
  };
}

export const listCategories = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await AssessmentCategoryModel.find({ isActive: true }).sort({ displayOrder: 1 }).lean();
  return ok(res, { categories }, 'Assessment categories.');
});

export const listAssessments = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as {
    page: number;
    limit: number;
    category?: string;
    status?: string;
    search?: string;
    includeArchived?: boolean;
  };

  const filter: Record<string, unknown> = {};
  if (query.category) filter.category = query.category;
  if (query.status) filter.status = query.status;
  else if (!query.includeArchived) filter.status = { $ne: 'archived' };
  if (query.search) filter.title = { $regex: escapeRegExp(query.search), $options: 'i' };

  // Candidates only ever see published, currently available test sets.
  const isPrivileged = req.user!.permissions.includes('assessments:write');
  if (!isPrivileged) {
    filter.status = 'published';
    filter.$or = [
      { availableFrom: { $exists: false } },
      { availableFrom: null },
      { availableFrom: { $lte: new Date() } },
    ];
    filter.$and = [{ $or: [{ availableUntil: { $exists: false } }, { availableUntil: null }, { availableUntil: { $gte: new Date() } }] }];
  }

  const [items, total] = await Promise.all([
    AssessmentModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    AssessmentModel.countDocuments(filter),
  ]);

  const data = isPrivileged ? items.map((i) => publicAssessment(i)) : items.map((i) => publicAssessment(i));
  return ok(res, { assessments: data }, 'Assessments retrieved.', paginationMeta(query.page, query.limit, total));
});

export const getAssessment = asyncHandler(async (req: Request, res: Response) => {
  const assessment = await AssessmentModel.findById(req.params.id).lean();
  if (!assessment) throw ApiError.notFound('Assessment not found.');

  const canManage = req.user!.permissions.includes('assessments:write');
  if (!canManage) {
    if (!isAssessmentAvailable(assessment)) {
      throw ApiError.forbidden('This assessment is not currently available.');
    }
    const batch = req.user!.role === 'student' ? undefined : undefined;
    if (assessment.assignedBatches.length > 0 && batch) {
      throw ApiError.forbidden('This assessment is not assigned to your group.');
    }
  }

  const poolSize = assessment.questionPool.length;
  return ok(
    res,
    {
      assessment: { ...publicAssessment(assessment as never), poolSize, assignedBatches: assessment.assignedBatches },
    },
    'Assessment retrieved.',
  );
});

export const createAssessment = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as AssessmentCreateInput;

  const poolCount = await QuestionModel.countDocuments({ _id: { $in: body.questionPool }, isActive: true });
  if (poolCount !== body.questionPool.length) {
    throw ApiError.validation('Invalid question pool.', [
      { field: 'questionPool', message: 'Every selected question must exist and be active.' },
    ]);
  }

  const invalidPool = await QuestionModel.find({
    _id: { $in: body.questionPool },
    isActive: true,
  }).select('questionType options correctOptionId preferenceDimension marks');

  const scorable = invalidPool.filter((q) => evaluateQuestionScorability(q).scorable).length;

  const totalMarks = Math.round(body.questionCount * body.marksPerQuestion * 100) / 100;

  const assessment = await AssessmentModel.create({
    ...body,
    totalMarks,
    createdBy: req.user!.id,
    isSample: false,
    scoringNote:
      body.scoringNote ??
      (body.category === 'personality'
        ? 'Preference instrument: responses are aggregated into indicative working-preference scores, not right or wrong answers.'
        : 'Objectively scored: marks are awarded from the configured answer key on the server.'),
  });

  await recordAudit(
    auditFromRequest(req, {
      action: 'assessment.create',
      category: 'admin',
      targetType: 'Assessment',
      targetId: String(assessment._id),
      message: `Created assessment "${assessment.title}" with ${body.questionPool.length} pooled questions (${scorable} scorable).`,
      metadata: { assessmentId: String(assessment._id), questionCount: body.questionCount },
    }),
  );

  return created(res, { assessment: publicAssessment(assessment.toObject() as never) }, 'Assessment created.');
});

export const updateAssessment = asyncHandler(async (req: Request, res: Response) => {
  const assessment = await AssessmentModel.findById(req.params.id);
  if (!assessment) throw ApiError.notFound('Assessment not found.');

  const body = req.body as Partial<AssessmentCreateInput>;

  if (body.questionPool) {
    const poolCount = await QuestionModel.countDocuments({ _id: { $in: body.questionPool }, isActive: true });
    if (poolCount !== body.questionPool.length) {
      throw ApiError.validation('Invalid question pool.', [
        { field: 'questionPool', message: 'Every selected question must exist and be active.' },
      ]);
    }
  }

  const questionCount = body.questionCount ?? assessment.questionCount;
  const marksPerQuestion = body.marksPerQuestion ?? assessment.marksPerQuestion;
  const poolSize = body.questionPool?.length ?? assessment.questionPool.length;
  if (questionCount > poolSize) {
    throw ApiError.validation('Invalid configuration.', [
      { field: 'questionCount', message: 'Question count cannot exceed the size of the question pool.' },
    ]);
  }

  const liveAttempt = await AttemptModel.countDocuments({ assessment: assessment._id, status: 'in_progress' });
  if (liveAttempt > 0 && (body.questionCount !== undefined || body.marksPerQuestion !== undefined)) {
    throw ApiError.conflict(
      'Cannot change the question count or marks while candidates have attempts in progress.',
    );
  }

  Object.assign(assessment, body, {
    totalMarks: Math.round(questionCount * marksPerQuestion * 100) / 100,
    updatedBy: req.user!.id,
  });
  await assessment.save();

  await recordAudit(
    auditFromRequest(req, {
      action: 'assessment.update',
      category: 'admin',
      targetType: 'Assessment',
      targetId: String(assessment._id),
      message: `Updated assessment "${assessment.title}".`,
      metadata: { assessmentId: String(assessment._id), field: Object.keys(body).join(',') },
    }),
  );

  return ok(res, { assessment: publicAssessment(assessment.toObject() as never) }, 'Assessment updated.');
});

export const setAssessmentStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.body as { status: 'draft' | 'published' | 'archived' };
  const assessment = await AssessmentModel.findById(req.params.id);
  if (!assessment) throw ApiError.notFound('Assessment not found.');

  if (status === 'published') {
    const activePool = await QuestionModel.countDocuments({
      _id: { $in: assessment.questionPool },
      isActive: true,
    });
    if (activePool < assessment.questionCount) {
      throw ApiError.unprocessable(
        `Cannot publish: ${assessment.questionCount} questions are required but only ${activePool} are active.`,
      );
    }
    if (assessment.questionCount > assessment.questionPool.length) {
      throw ApiError.unprocessable('Cannot publish: question count exceeds the pool size.');
    }
  }

  assessment.status = status;
  assessment.updatedBy = req.user!.id as never;
  await assessment.save();

  await recordAudit(
    auditFromRequest(req, {
      action: 'assessment.status_change',
      category: 'admin',
      targetType: 'Assessment',
      targetId: String(assessment._id),
      message: `Assessment "${assessment.title}" status changed to ${status}.`,
      metadata: { assessmentId: String(assessment._id), status },
    }),
  );

  return ok(res, { assessment: publicAssessment(assessment.toObject() as never) }, 'Assessment status updated.');
});

export const deleteAssessment = asyncHandler(async (req: Request, res: Response) => {
  const assessment = await AssessmentModel.findById(req.params.id);
  if (!assessment) throw ApiError.notFound('Assessment not found.');

  const attemptCount = await AttemptModel.countDocuments({ assessment: assessment._id });
  if (attemptCount > 0) {
    throw ApiError.conflict(
      'This assessment has recorded attempts and cannot be deleted. Archive it instead so assessment history is preserved.',
    );
  }

  await assessment.deleteOne();
  await recordAudit(
    auditFromRequest(req, {
      action: 'assessment.delete',
      category: 'admin',
      severity: 'warning',
      targetType: 'Assessment',
      targetId: String(assessment._id),
      message: `Deleted draft assessment "${assessment.title}".`,
    }),
  );
  return ok(res, { deleted: true }, 'Assessment deleted.');
});

// ---------------------------------------------------------------------------
// Attempts
// ---------------------------------------------------------------------------

export const listAvailableAssessments = asyncHandler(async (req: Request, res: Response) => {
  const user = await UserModel.findById(req.user!.id).select('studentProfile.batch').lean();
  const batch = user?.studentProfile?.batch;

  const assessments = await AssessmentModel.find({
    status: 'published',
    $and: [
      { $or: [{ availableFrom: { $exists: false } }, { availableFrom: null }, { availableFrom: { $lte: new Date() } }] },
      { $or: [{ availableUntil: { $exists: false } }, { availableUntil: null }, { availableUntil: { $gte: new Date() } }] },
    ],
  })
    .sort({ category: 1, title: 1 })
    .lean();

  const visible = assessments.filter((a) => a.assignedBatches.length === 0 || (batch ? a.assignedBatches.includes(batch) : true));

  const attempts = await AttemptModel.find({
    candidate: req.user!.id,
    status: { $in: ['in_progress', 'submitted', 'auto_submitted', 'expired'] },
  })
    .select('assessment status')
    .lean();

  const byAssessment = new Map<string, { used: number; liveId: string | null }>();
  for (const attempt of attempts) {
    const key = String(attempt.assessment);
    const entry = byAssessment.get(key) ?? { used: 0, liveId: null };
    if (attempt.status === 'in_progress') entry.liveId = String(attempt._id);
    else entry.used += 1;
    byAssessment.set(key, entry);
  }

  return ok(
    res,
    {
      assessments: visible.map((a) => {
        const state = byAssessment.get(String(a._id)) ?? { used: 0, liveId: null };
        return {
          ...publicAssessment(a as never),
          assignedBatches: undefined,
          attemptsUsed: state.used,
          attemptsRemaining: Math.max(0, a.maxAttempts - state.used),
          liveAttemptId: state.liveId,
          eligible: state.used < a.maxAttempts || state.liveId !== null,
          batchRestricted: a.assignedBatches.length > 0,
        };
      }),
    },
    'Available assessments.',
  );
});

export const startAttemptHandler = asyncHandler(async (req: Request, res: Response) => {
  const user = await (await import('../models/User.js')).UserModel.findById(req.user!.id)
    .select('studentProfile.batch')
    .lean();
  const batch = user?.studentProfile?.batch;

  const attemptId = await startAttempt({
    candidateId: req.user!.id,
    candidateBatch: batch,
    assessmentId: req.body.assessmentId,
    context: { ipAddress: req.ip, userAgent: req.get('user-agent') },
  });

  const payload = await buildAttemptPayload(String(attemptId), req.user!.id);

  await recordAudit(
    auditFromRequest(req, {
      action: 'attempt.start',
      category: 'assessment',
      targetType: 'Attempt',
      targetId: String(attemptId),
      message: `Started attempt for assessment "${payload.attempt.assessmentTitle}".`,
      metadata: {
        attemptId: String(attemptId),
        assessmentId: payload.attempt.assessmentId,
        durationMinutes: payload.attempt.durationMinutes,
      },
    }),
  );

  return created(res, payload, 'Attempt started.');
});

export const getAttempt = asyncHandler(async (req: Request, res: Response) => {
  const payload = await buildAttemptPayload(req.params.id, req.user!.id);
  return ok(res, payload, 'Attempt loaded.');
});

export const putAnswers = asyncHandler(async (req: Request, res: Response) => {
  const { answers } = req.body as SaveAnswersInput;
  const result = await saveAnswers({
    attemptId: req.params.id,
    candidateId: req.user!.id,
    answers,
    context: { ipAddress: req.ip, userAgent: req.get('user-agent') },
  });
  return ok(res, result, 'Answers saved.');
});

export const submitAttempt = asyncHandler(async (req: Request, res: Response) => {
  const attemptId = req.params.id;
  await loadAttemptForCandidate(attemptId, req.user!.id);

  const result = await finaliseAttempt({
    attemptId,
    reason: 'manual',
    context: { ipAddress: req.ip, userAgent: req.get('user-agent') },
  });

  await recordAudit(
    auditFromRequest(req, {
      action: 'attempt.submit',
      category: 'assessment',
      targetType: 'Attempt',
      targetId: attemptId,
      message: result.alreadyFinalised
        ? 'Duplicate submission rejected; attempt was already finalised.'
        : 'Attempt submitted and scored on the server.',
      outcome: result.alreadyFinalised ? 'failure' : 'success',
      severity: result.alreadyFinalised ? 'warning' : 'info',
    }),
  );

  const payload = await buildResultPayload(attemptId, req.user!.id);
  return ok(res, payload, result.alreadyFinalised ? 'This attempt was already submitted.' : 'Attempt submitted.');
});

export const getAttemptResult = asyncHandler(async (req: Request, res: Response) => {
  const payload = await buildResultPayload(req.params.id, req.user!.id);
  return ok(res, payload, 'Attempt result.');
});

export const attemptHistory = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as { page: number; limit: number; status?: string; category?: string };
  const filter: Record<string, unknown> = { candidate: req.user!.id, status: { $ne: 'in_progress' } };
  if (query.status) filter.status = query.status;
  if (query.category) filter.assessmentCategory = query.category;

  const [items, total] = await Promise.all([
    AttemptModel.find(filter)
      .sort({ submittedAt: -1, createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    AttemptModel.countDocuments(filter),
  ]);

  return ok(
    res,
    {
      attempts: items.map((item) => ({
        id: String(item._id),
        assessmentId: String(item.assessment),
        assessmentTitle: item.assessmentTitle,
        category: item.assessmentCategory,
        scoringModel: item.assessmentCategory === 'personality' ? 'preference' : 'objective',
        status: item.status,
        submissionReason: item.submissionReason,
        percentage: item.assessmentCategory === 'personality' ? null : item.percentage,
        passed: item.assessmentCategory === 'personality' ? null : item.passed,
        marksObtained: item.assessmentCategory === 'personality' ? null : item.marksObtained,
        totalMarks: item.assessmentCategory === 'personality' ? null : item.totalMarks,
        answeredCount: item.answeredCount,
        totalQuestions: item.totalQuestions,
        timeSpentSeconds: item.timeSpentSeconds,
        submittedAt: item.submittedAt,
        skillResults: item.skillResults,
      })),
    },
    'Assessment history.',
    paginationMeta(query.page, query.limit, total),
  );
});

/** Counsellor / admin view of a single student's attempt. */
export const getAttemptForSupervisor = asyncHandler(async (req: Request, res: Response) => {
  const attempt = await AttemptModel.findById(req.params.id);
  if (!attempt) throw ApiError.notFound('Attempt not found.');

  const candidate = await UserModel.findById(attempt.candidate).select('fullName email studentProfile.batch');
  if (!candidate) throw ApiError.notFound('Candidate not found.');
  if (!Types.ObjectId.isValid(req.params.id)) throw ApiError.badRequest('Invalid attempt identifier.');

  const payload = await buildResultPayload(String(attempt._id), String(attempt.candidate));
  return ok(res, { ...payload, candidate: { id: String(candidate._id), fullName: candidate.fullName, email: candidate.email, batch: candidate.studentProfile?.batch } }, 'Attempt result.');
});
