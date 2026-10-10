import type { Request, Response } from 'express';
import { QuestionModel, evaluateQuestionScorability } from '../models/Question.js';
import { AssessmentModel } from '../models/Assessment.js';
import { AttemptModel } from '../models/Attempt.js';
import { SkillModel } from '../models/Skill.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { created, ok, paginationMeta } from '../utils/response.js';
import { escapeRegExp } from '../utils/pagination.js';
import { recordAudit, auditFromRequest } from '../services/audit/auditService.js';
import type { QuestionCreateInput } from '../schemas/assessment.schema.js';

/** Shape returned to the question bank UI. Correct answers are visible here
 *  because only question authors (counsellor / admin) can reach this endpoint. */
function serialiseQuestion(doc: Record<string, unknown>) {
  return {
    id: String(doc._id),
    text: doc.text,
    category: doc.category,
    topic: doc.topic,
    questionType: doc.questionType,
    options: doc.options,
    correctOptionId: doc.correctOptionId ?? null,
    preferenceDimension: doc.preferenceDimension ?? null,
    scaleMin: doc.scaleMin ?? null,
    scaleMax: doc.scaleMax ?? null,
    explanation: doc.explanation ?? null,
    difficulty: doc.difficulty,
    skillMappings: doc.skillMappings,
    marks: doc.marks,
    isActive: doc.isActive,
    isSample: doc.isSample,
    usageCount: doc.usageCount ?? 0,
    scorable: evaluateQuestionScorability(doc as never).scorable,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export const listQuestions = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as {
    page: number;
    limit: number;
    category?: string;
    difficulty?: string;
    questionType?: string;
    isActive?: boolean;
    skill?: string;
    search?: string;
  };

  const filter: Record<string, unknown> = {};
  if (query.category) filter.category = query.category;
  if (query.difficulty) filter.difficulty = query.difficulty;
  if (query.questionType) filter.questionType = query.questionType;
  if (query.isActive !== undefined) filter.isActive = query.isActive;
  if (query.skill) filter['skillMappings.skill'] = query.skill;
  if (query.search) {
    const rx = { $regex: escapeRegExp(query.search), $options: 'i' };
    filter.$or = [{ text: rx }, { topic: rx }];
  }

  const [items, total] = await Promise.all([
    QuestionModel.find(filter)
      .sort({ category: 1, topic: 1, createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    QuestionModel.countDocuments(filter),
  ]);

  return ok(
    res,
    { questions: items.map((q) => serialiseQuestion(q as never)) },
    'Question bank.',
    paginationMeta(query.page, query.limit, total),
  );
});

export const getQuestion = asyncHandler(async (req: Request, res: Response) => {
  const question = await QuestionModel.findById(req.params.id).lean();
  if (!question) throw ApiError.notFound('Question not found.');
  return ok(res, { question: serialiseQuestion(question as never) }, 'Question.');
});

export const createQuestion = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as QuestionCreateInput;

  if (body.skillMappings.length > 0) {
    const count = await SkillModel.countDocuments({ _id: { $in: body.skillMappings.map((m) => m.skill) }, isActive: true });
    if (count !== body.skillMappings.length) {
      throw ApiError.validation('Invalid skill mapping.', [
        { field: 'skillMappings', message: 'Every mapped skill must exist and be active.' },
      ]);
    }
  }

  const question = await QuestionModel.create({
    ...body,
    author: req.user!.id,
    isSample: false,
  });

  await recordAudit(
    auditFromRequest(req, {
      action: 'question.create',
      category: 'admin',
      targetType: 'Question',
      targetId: String(question._id),
      message: `Created ${question.questionType.toUpperCase()} question in ${question.category}.`,
      metadata: { questionId: String(question._id), category: question.category },
    }),
  );

  return created(res, { question: serialiseQuestion(question.toObject() as never) }, 'Question created.');
});

export const updateQuestion = asyncHandler(async (req: Request, res: Response) => {
  const question = await QuestionModel.findById(req.params.id);
  if (!question) throw ApiError.notFound('Question not found.');

  const body = req.body as Partial<QuestionCreateInput>;

  if (body.skillMappings && body.skillMappings.length > 0) {
    const count = await SkillModel.countDocuments({ _id: { $in: body.skillMappings.map((m) => m.skill) }, isActive: true });
    if (count !== body.skillMappings.length) {
      throw ApiError.validation('Invalid skill mapping.', [
        { field: 'skillMappings', message: 'Every mapped skill must exist and be active.' },
      ]);
    }
  }

  // Editing an item that has already been answered would silently change
  // historical results, so such items are frozen.
  const usedInAttempts = await AttemptModel.countDocuments({ questionOrder: question._id });
  if (usedInAttempts > 0) {
    const riskyFields = ['correctOptionId', 'options', 'preferenceDimension', 'skillMappings', 'marks'].filter(
      (f) => body[f as keyof typeof body] !== undefined,
    );
    if (riskyFields.length > 0) {
      throw ApiError.conflict(
        `This question has already appeared in ${usedInAttempts} attempt(s), so changing ${riskyFields.join(', ')} would alter historical results. Deactivate it or create a replacement instead.`,
      );
    }
  }

  Object.assign(question, body, { updatedBy: req.user!.id as never });
  await question.save();

  await recordAudit(
    auditFromRequest(req, {
      action: 'question.update',
      category: 'admin',
      targetType: 'Question',
      targetId: String(question._id),
      message: `Updated question ${String(question._id)}.`,
      metadata: { questionId: String(question._id), field: Object.keys(body).join(',') },
    }),
  );

  return ok(res, { question: serialiseQuestion(question.toObject() as never) }, 'Question updated.');
});

export const deleteQuestion = asyncHandler(async (req: Request, res: Response) => {
  const question = await QuestionModel.findById(req.params.id);
  if (!question) throw ApiError.notFound('Question not found.');

  const [attemptUsage, assessmentUsage] = await Promise.all([
    AttemptModel.countDocuments({ questionOrder: question._id }),
    AssessmentModel.countDocuments({ questionPool: question._id }),
  ]);

  if (attemptUsage > 0) {
    throw ApiError.conflict(
      `This question has been used in ${attemptUsage} recorded attempt(s) and cannot be deleted without corrupting assessment history. Deactivate it instead.`,
    );
  }

  if (assessmentUsage > 0) {
    await AssessmentModel.updateMany({ questionPool: question._id }, { $pull: { questionPool: question._id } });
  }

  await question.deleteOne();

  await recordAudit(
    auditFromRequest(req, {
      action: 'question.delete',
      category: 'admin',
      severity: 'warning',
      targetType: 'Question',
      targetId: String(question._id),
      message: `Deleted question ${String(question._id)}${assessmentUsage > 0 ? ` and removed it from ${assessmentUsage} test set(s).` : '.'}`,
      metadata: { questionId: String(question._id), deletedCount: assessmentUsage },
    }),
  );

  return ok(res, { deleted: true, removedFromAssessments: assessmentUsage }, 'Question deleted.');
});

export const setQuestionActive = asyncHandler(async (req: Request, res: Response) => {
  const { isActive } = req.body as { isActive: boolean };
  const question = await QuestionModel.findById(req.params.id);
  if (!question) throw ApiError.notFound('Question not found.');

  question.isActive = isActive;
  question.updatedBy = req.user!.id as never;
  await question.save();

  await recordAudit(
    auditFromRequest(req, {
      action: isActive ? 'question.activate' : 'question.deactivate',
      category: 'admin',
      targetType: 'Question',
      targetId: String(question._id),
      message: `${isActive ? 'Activated' : 'Deactivated'} question ${String(question._id)}.`,
      metadata: { questionId: String(question._id), status: isActive ? 'active' : 'inactive' },
    }),
  );

  return ok(res, { question: serialiseQuestion(question.toObject() as never) }, 'Question status updated.');
});
