import type { Types } from 'mongoose';
import { AssessmentModel } from '../../models/Assessment.js';
import { AttemptModel } from '../../models/Attempt.js';
import { AnswerModel } from '../../models/Answer.js';
import { QuestionModel } from '../../models/Question.js';
import { SkillModel } from '../../models/Skill.js';
import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../../utils/logger.js';
import {
  AttemptScorer,
  aggregatePreferences,
  aggregateSkillContributions,
  normalisePercentage,
  round,
  type ScoredAnswer,
} from './scoringService.js';
import { applyAttemptToSkillProfile } from './skillProfileService.js';

const FINAL_STATES = ['submitted', 'auto_submitted', 'expired'] as const;

export interface AttemptContext {
  ipAddress?: string;
  userAgent?: string;
}

/** Fisher-Yates shuffle with a cryptographic source of randomness. */
function shuffle<T>(items: T[]): T[] {
  const array = [...items];
  const random = <T,>(max: number): number => {
    const buf = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buf);
    return buf[0] % max;
  };
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = random(i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function isFinalStatus(status: string): boolean {
  return (FINAL_STATES as readonly string[]).includes(status);
}

/** Assessment is visible to a candidate when published and inside its window. */
export function isAssessmentAvailable(assessment: {
  status: string;
  availableFrom?: Date | null;
  availableUntil?: Date | null;
  assignedBatches?: string[];
}): boolean {
  if (assessment.status !== 'published') return false;
  const now = new Date();
  if (assessment.availableFrom && assessment.availableFrom.getTime() > now.getTime()) return false;
  if (assessment.availableUntil && assessment.availableUntil.getTime() < now.getTime()) return false;
  return true;
}

/**
 * Creates a live attempt. A refresh-safe design is used: the attempt is created
 * once and the candidate is redirected back to it, so reloading the page never
 * resets the official timer.
 */
export async function startAttempt(options: {
  candidateId: Types.ObjectId | string;
  candidateBatch?: string;
  assessmentId: Types.ObjectId | string;
  context?: AttemptContext;
}): Promise<Types.ObjectId> {
  const { candidateId, candidateBatch, assessmentId, context } = options;

  const assessment = await AssessmentModel.findById(assessmentId);
  if (!assessment) throw ApiError.notFound('Assessment not found.');
  if (!isAssessmentAvailable(assessment)) {
    throw ApiError.forbidden('This assessment is not currently available.');
  }
  if (
    assessment.assignedBatches.length > 0 &&
    candidateBatch &&
    !assessment.assignedBatches.includes(candidateBatch)
  ) {
    throw ApiError.forbidden('This assessment is not assigned to your batch.');
  }

  // Reuse the existing live attempt instead of creating a second one.
  const live = await AttemptModel.findOne({
    candidate: candidateId,
    assessment: assessmentId,
    status: 'in_progress',
  });
  if (live) {
    // If the previous attempt already expired, finalise it before returning.
    if (live.expiresAt.getTime() <= Date.now()) {
      await finaliseAttempt({
        attemptId: String(live._id),
        reason: 'time_expired',
        context,
      });
      throw ApiError.gone('Your previous attempt expired. Start a new attempt to continue.');
    }
    return live._id;
  }

  const usedAttempts = await AttemptModel.countDocuments({
    candidate: candidateId,
    assessment: assessmentId,
    status: { $in: [...FINAL_STATES] },
  });
  if (usedAttempts >= assessment.maxAttempts) {
    throw ApiError.forbidden(
      `You have already used all ${assessment.maxAttempts} attempt(s) allowed for this assessment.`,
    );
  }

  const pool = await QuestionModel.find({
    _id: { $in: assessment.questionPool },
    isActive: true,
    category: assessment.category,
  }).select('_id options');

  if (pool.length === 0) {
    throw ApiError.unprocessable(
      'This assessment currently has no active questions in its pool, so it cannot be started.',
    );
  }

  const chosen = (assessment.shuffleAtAttempt ? shuffle(pool) : pool).slice(0, assessment.questionCount);
  const questionIds = chosen.map((q) => q._id);

  const optionOrders: Record<string, string[]> = {};
  if (assessment.shuffleOptions) {
    for (const question of chosen) {
      optionOrders[String(question._id)] = shuffle(question.options.map((o) => o.optionId));
    }
  } else {
    for (const question of chosen) {
      optionOrders[String(question._id)] = question.options.map((o) => o.optionId);
    }
  }

  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + assessment.durationMinutes * 60 * 1000);

  const attempt = await AttemptModel.create({
    candidate: candidateId,
    assessment: assessment._id,
    assessmentTitle: assessment.title,
    assessmentCategory: assessment.category,
    status: 'in_progress',
    startedAt,
    expiresAt,
    questionOrder: questionIds,
    optionOrders,
    durationMinutes: assessment.durationMinutes,
    totalQuestions: questionIds.length,
    marksPerQuestion: assessment.marksPerQuestion,
    totalMarks: round(assessment.questionCount * assessment.marksPerQuestion),
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent?.slice(0, 300),
    isFlagged: true,
  });

  // Seed blank answer documents so a refresh restores exactly the same slots.
  await AnswerModel.insertMany(
    questionIds.map((questionId, index) => ({
      attempt: attempt._id,
      question: questionId,
      candidate: candidateId,
      assessment: assessment._id,
      displayIndex: index + 1,
      marksPossible: assessment.marksPerQuestion,
      isAnswered: false,
      evaluationStatus: 'unanswered',
      isFlagged: false,
    })),
  );

  // Keep the denormalised attempt counter in step for the admin dashboard.
  await AssessmentModel.updateOne({ _id: assessment._id }, { $inc: { attemptCount: 1 } });

  return attempt._id;
}
/** Loads an attempt the candidate is allowed to work on. */
export async function loadAttemptForCandidate(attemptId: string, candidateId: string) {
  const attempt = await AttemptModel.findOne({ _id: attemptId, candidate: candidateId });
  if (!attempt) throw ApiError.notFound('Attempt not found.');
  return attempt;
}

export interface AttemptPayload {
  attempt: {
    id: string;
    assessmentId: string;
    assessmentTitle: string;
    category: string;
    status: string;
    startedAt: Date;
    expiresAt: Date;
    durationMinutes: number;
    totalQuestions: number;
    totalMarks: number;
    answeredCount: number;
    flaggedCount: number;
    serverTime: Date;
    secondsRemaining: number;
    isFinalised: boolean;
  };
  questions: Array<{
    id: string;
    text: string;
    topic: string;
    questionType: 'mcq' | 'likert';
    options: Array<{ optionId: string; text: string }>;
    scaleMin?: number;
    scaleMax?: number;
    marks: number;
    displayIndex: number;
  }>;
  savedAnswers: Array<{ questionId: string; selectedOptionId?: string; isFlagged: boolean }>;
}

/**
 * Builds the candidate-visible attempt payload. Correct answers, marks awarded
 * and skill mappings are deliberately excluded until the attempt is finalised.
 */
export async function buildAttemptPayload(
  attemptId: string,
  candidateId: string,
): Promise<AttemptPayload> {
  const attempt = await loadAttemptForCandidate(attemptId, candidateId);
  const serverTime = new Date();

  const [questions, answers] = await Promise.all([
    QuestionModel.find({
      _id: { $in: attempt.questionOrder },
    }).select('text topic questionType options scaleMin scaleMax marks'),
    AnswerModel.find({ attempt: attempt._id }).select('question selectedOptionId isFlagged displayIndex'),
  ]);

  const questionById = new Map(questions.map((q) => [String(q._id), q]));
  const orders = (attempt.optionOrders ?? {}) as Record<string, string[]>;

  const ordered = attempt.questionOrder
    .map((id, index) => ({ id: String(id), question: questionById.get(String(id)), index }))
    .filter((entry): entry is { id: string; question: NonNullable<typeof entry.question>; index: number } =>
      Boolean(entry.question),
    );

  const now = Date.now();
  const secondsRemaining = Math.max(0, Math.floor((attempt.expiresAt.getTime() - now) / 1000));

  return {
    attempt: {
      id: String(attempt._id),
      assessmentId: String(attempt.assessment),
      assessmentTitle: attempt.assessmentTitle,
      category: attempt.assessmentCategory,
      status: attempt.status,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      durationMinutes: attempt.durationMinutes,
      totalQuestions: attempt.totalQuestions,
      totalMarks: attempt.totalMarks,
      answeredCount: attempt.answeredCount,
      flaggedCount: attempt.flaggedCount,
      serverTime,
      secondsRemaining,
      isFinalised: isFinalStatus(attempt.status),
    },
    questions: ordered.map((entry, displayIndex) => {
      const optionIds = orders[entry.id] ?? entry.question.options.map((o) => o.optionId);
      const byId = new Map(entry.question.options.map((o) => [o.optionId, o]));
      return {
        id: entry.id,
        text: entry.question.text,
        topic: entry.question.topic,
        questionType: entry.question.questionType as 'mcq' | 'likert',
        options: optionIds.map((id) => byId.get(id)).filter(Boolean).map((o) => ({ optionId: o!.optionId, text: o!.text })),
        scaleMin: entry.question.scaleMin ?? undefined,
        scaleMax: entry.question.scaleMax ?? undefined,
        marks: attempt.marksPerQuestion,
        displayIndex: displayIndex + 1,
      };
    }),
    savedAnswers: answers.map((a) => ({
      questionId: String(a.question),
      selectedOptionId: a.selectedOptionId ?? undefined,
      isFlagged: a.isFlagged ?? false,
    })),
  };
}

/**
 * Persists answers. Rejects the write when the attempt is finalised or past its
 * server-recorded deadline.
 */
export async function saveAnswers(options: {
  attemptId: string;
  candidateId: string;
  answers: Array<{ questionId: string; selectedOptionId?: string; isFlagged?: boolean }>;
  context?: AttemptContext;
}): Promise<{ answeredCount: number; flaggedCount: number; secondsRemaining: number }> {
  const attempt = await loadAttemptForCandidate(options.attemptId, options.candidateId);

  if (isFinalStatus(attempt.status)) {
    throw ApiError.conflict('This attempt has already been submitted and can no longer be changed.');
  }
  if (attempt.expiresAt.getTime() <= Date.now()) {
    await finaliseAttempt({ attemptId: options.attemptId, reason: 'time_expired', context: options.context });
    throw ApiError.gone('Time for this attempt has expired. Your saved answers were submitted automatically.');
  }

  const validIds = new Set(attempt.questionOrder.map((id) => String(id)));
  const rejected = options.answers.filter((a) => !validIds.has(a.questionId));
  if (rejected.length > 0) {
    throw ApiError.badRequest('One or more questions do not belong to this attempt.');
  }

  const operations = options.answers.map((answer) => {
    const set: Record<string, unknown> = { savedAt: new Date() };
    if (answer.selectedOptionId !== undefined) {
      set.selectedOptionId = answer.selectedOptionId;
      // The counter is derived from this flag, so it must be kept in step.
      set.isAnswered = answer.selectedOptionId !== '';
    }
    if (answer.isFlagged !== undefined) set.isFlagged = answer.isFlagged;
    return {
      updateOne: {
        filter: { attempt: attempt._id, question: answer.questionId },
        update: { $set: set },
      },
    };
  });

  await AnswerModel.bulkWrite(operations, { ordered: false });

  // Recompute the counters from the database rather than trusting the client.
  const [answeredCount, flaggedCount] = await Promise.all([
    AnswerModel.countDocuments({ attempt: attempt._id, isAnswered: true }),
    AnswerModel.countDocuments({ attempt: attempt._id, isFlagged: true }),
  ]);

  attempt.answeredCount = answeredCount;
  attempt.flaggedCount = flaggedCount;
  attempt.lastSavedAt = new Date();
  await attempt.save();

  return {
    answeredCount,
    flaggedCount,
    secondsRemaining: Math.max(0, Math.floor((attempt.expiresAt.getTime() - Date.now()) / 1000)),
  };
}

/**
 * Scores and finalises an attempt. Safe to call twice: the second call is a
 * no-op, which prevents duplicate submission.
 */
export async function finaliseAttempt(options: {
  attemptId: string;
  reason: 'manual' | 'time_expired' | 'admin';
  context?: AttemptContext;
}): Promise<{ alreadyFinalised: boolean }> {
  const attempt = await AttemptModel.findById(options.attemptId);
  if (!attempt) throw ApiError.notFound('Attempt not found.');
  if (isFinalStatus(attempt.status)) return { alreadyFinalised: true };

  // Claim the attempt atomically so concurrent submits cannot both score it.
  const claimed = await AttemptModel.findOneAndUpdate(
    { _id: attempt._id, status: 'in_progress' },
    { $set: { status: options.reason === 'time_expired' ? 'auto_submitted' : 'submitted' } },
    { new: false },
  );
  if (!claimed) return { alreadyFinalised: true };

  const [questions, answers] = await Promise.all([
    QuestionModel.find({ _id: { $in: attempt.questionOrder } }),
    AnswerModel.find({ attempt: attempt._id }),
  ]);

  const responseMap = new Map<string, string | undefined>();
  for (const answer of answers) {
    responseMap.set(
      String(answer.question),
      answer.selectedOptionId ?? undefined,
    );
  }

  const scorer = new AttemptScorer(
    questions.map((q) => ({
      _id: q._id,
      text: q.text,
      questionType: q.questionType as 'mcq' | 'likert',
      options: q.options as never,
      correctOptionId: q.correctOptionId,
      preferenceDimension: q.preferenceDimension,
      marks: q.marks,
      skillMappings: (q.skillMappings ?? []) as never,
    })),
  );

  const scored = scorer.score(responseMap);
  const skillTotals = aggregateSkillContributions(scored.answers);
  const preferences = aggregatePreferences(scored.answers);

  const percentage = normalisePercentage(scored.marksObtained, scored.scorableMarks);
  const isPreferenceTest = attempt.assessmentCategory === 'personality';

  // Personallity instruments are not pass/fail examinations, so no pass flag
  // and no percentage is reported for them.
  const passed = isPreferenceTest ? undefined : percentage >= (await passingPercentage(attempt.assessment));

  // Persist per-answer evaluation results (server-side only).
  const answerWrites = scored.answers.map((answer) => ({
    updateOne: {
      filter: { attempt: attempt._id, question: answer.questionId },
      update: {
        $set: {
          marksAwarded: answer.marksAwarded,
          marksPossible: answer.marksPossible,
          isCorrect: answer.isCorrect,
          evaluationStatus: answer.evaluationStatus,
          invalidReason: answer.invalidReason,
          skillContributions: answer.skillContributions.map((c) => ({ ...c, skill: c.skill as never })),
          preferenceContribution: answer.preferenceContribution,
          submittedAt: new Date(),
        },
      },
    },
  }));
  await AnswerModel.bulkWrite(answerWrites as never[], { ordered: false });

  const skills = await SkillModel.find({ _id: { $in: skillTotals.map((t) => t.skill) } })
    .select('code name')
    .lean();
  const skillMeta = new Map(skills.map((s) => [String(s._id), s]));

  const submittedAt = new Date();
  attempt.status = options.reason === 'time_expired' ? 'auto_submitted' : 'submitted';
  attempt.submittedAt = submittedAt;
  attempt.evaluatedAt = submittedAt;
  attempt.submissionReason = options.reason;
  attempt.marksObtained = scored.marksObtained;
  attempt.scorableMarks = scored.scorableMarks;
  attempt.score = isPreferenceTest ? 0 : percentage;
  attempt.percentage = isPreferenceTest ? 0 : percentage;
  attempt.passed = passed;
  attempt.answeredCount = scored.answeredCount;
  attempt.timeSpentSeconds = Math.max(
    0,
    Math.round((Math.min(submittedAt.getTime(), attempt.expiresAt.getTime()) - attempt.startedAt.getTime()) / 1000),
  );
  attempt.isFlagged = false;
  attempt.invalidQuestionIds = scored.invalidQuestions.map((q) => q.questionId) as never;
  attempt.skillResults = skillTotals.map((total) => ({
    skill: total.skill as never,
    skillCode: skillMeta.get(total.skill)?.code ?? '',
    skillName: skillMeta.get(total.skill)?.name ?? '',
    marksObtained: total.marksObtained,
    marksPossible: total.marksPossible,
    score: normalisePercentage(total.marksObtained, total.marksPossible),
    evidenceCount: total.marksPossible,
  })) as never;
  attempt.preferenceResults = preferences as never;
  attempt.personalityResponses = scored.answers
    .filter((a) => a.evaluationStatus === 'preference')
    .map((a) => ({
      question: a.questionId as never,
      dimension: a.preferenceContribution?.dimension,
      optionId: a.selectedOptionId,
    })) as never;

  await attempt.save();

  if (scored.invalidQuestions.length > 0) {
    logger.warn('assessment.invalid_items_excluded', {
      attemptId: String(attempt._id),
      count: scored.invalidQuestions.length,
    });
  }

  // Update the structured skill profile from the real result.
  await applyAttemptToSkillProfile({
    candidateId: String(attempt.candidate),
    attemptId: String(attempt._id),
    assessmentId: String(attempt.assessment),
    assessmentTitle: attempt.assessmentTitle,
    measurements: skillTotals.map((total) => ({
      skill: total.skill,
      skillCode: skillMeta.get(total.skill)?.code,
      skillName: skillMeta.get(total.skill)?.name,
      score: normalisePercentage(total.marksObtained, total.marksPossible),
      evidence: total.marksPossible,
    })),
  });

  return { alreadyFinalised: false };
}

const passingPercentageCache = new Map<string, { value: number; at: number }>();

async function passingPercentage(assessmentId: unknown): Promise<number> {
  const key = String(assessmentId);
  const cached = passingPercentageCache.get(key);
  if (cached && Date.now() - cached.at < 60_000) return cached.value;
  const assessment = await AssessmentModel.findById(assessmentId).select('passingPercentage').lean();
  const value = assessment?.passingPercentage ?? 40;
  passingPercentageCache.set(key, { value, at: Date.now() });
  return value;
}

/**
 * Candidate-visible result. Correct answers are only revealed once the attempt
 * is finalised, and only for objective items.
 */
export async function buildResultPayload(attemptId: string, candidateId: string) {
  const attempt = await AttemptModel.findOne({ _id: attemptId, candidate: candidateId });
  if (!attempt) throw ApiError.notFound('Attempt not found.');
  if (!isFinalStatus(attempt.status)) {
    throw ApiError.conflict('This attempt has not been submitted yet.');
  }

  const [questions, answers] = await Promise.all([
    QuestionModel.find({ _id: { $in: attempt.questionOrder } }),
    AnswerModel.find({ attempt: attempt._id }).sort({ displayIndex: 1 }),
  ]);

  const questionById = new Map(questions.map((q) => [String(q._id), q]));
  const isPersonality = attempt.assessmentCategory === 'personality';

  const review = answers
    .map((answer) => {
      const question = questionById.get(String(answer.question));
      if (!question) return null;
      return {
        questionId: String(answer.question),
        text: question.text,
        topic: question.topic,
        questionType: question.questionType,
        selectedOptionId: answer.selectedOptionId ?? null,
        correctOptionId: isPersonality ? null : (question.correctOptionId ?? null),
        isCorrect: isPersonality ? null : (answer.isCorrect ?? false),
        marksAwarded: isPersonality ? null : (answer.marksAwarded ?? 0),
        marksPossible: answer.marksPossible,
        evaluationStatus: answer.evaluationStatus,
        invalidReason: answer.invalidReason ?? null,
        explanation: isPersonality ? null : (question.explanation ?? null),
      };
    })
    .filter(Boolean);

  return {
    id: String(attempt._id),
    assessmentId: String(attempt.assessment),
    assessmentTitle: attempt.assessmentTitle,
    category: attempt.assessmentCategory,
    scoringModel: isPersonality ? 'preference' : 'objective',
    status: attempt.status,
    submissionReason: attempt.submissionReason,
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt,
    timeSpentSeconds: attempt.timeSpentSeconds,
    totalQuestions: attempt.totalQuestions,
    answeredCount: attempt.answeredCount,
    marksObtained: isPersonality ? null : attempt.marksObtained,
    totalMarks: isPersonality ? null : attempt.totalMarks,
    /**
     * Marks actually used as the denominator. Lower than `totalMarks` when items
     * were excluded by the test-validation rule, so the UI can explain why.
     */
    scorableMarks: isPersonality ? null : attempt.scorableMarks,
    percentage: isPersonality ? null : attempt.percentage,
    passed: isPersonality ? null : attempt.passed,
    invalidItemCount: attempt.invalidQuestionIds?.length ?? 0,
    skillResults: attempt.skillResults ?? [],
    preferenceResults: attempt.preferenceResults ?? [],
    review,
  };
}

/** Finalises every live attempt whose server deadline has passed. */
export async function sweepExpiredAttempts(limit = 50): Promise<number> {
  const expired = await AttemptModel.find({
    status: 'in_progress',
    expiresAt: { $lte: new Date() },
  })
    .limit(limit)
    .select('_id');

  let processed = 0;
  for (const attempt of expired) {
    try {
      const result = await finaliseAttempt({ attemptId: String(attempt._id), reason: 'time_expired' });
      if (!result.alreadyFinalised) processed += 1;
    } catch (error) {
      logger.error('attempt.sweep_failed', { attemptId: String(attempt._id), message: (error as Error).message });
    }
  }
  if (processed > 0) logger.info('attempt.sweep_completed', { processed });
  return processed;
}

export type { ScoredAnswer };
