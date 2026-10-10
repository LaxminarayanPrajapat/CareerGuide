import type { Types } from 'mongoose';
import { AttemptModel } from '../../models/Attempt.js';
import { CandidateSkillProfileModel } from '../../models/CandidateSkillProfile.js';
import { CareerModel } from '../../models/Career.js';
import { CareerReportModel } from '../../models/CareerReport.js';
import { UserModel } from '../../models/User.js';
import { AssessmentModel } from '../../models/Assessment.js';
import { QuestionModel } from '../../models/Question.js';
import { SkillModel } from '../../models/Skill.js';
import { RoadmapModel } from '../../models/Roadmap.js';
import { round } from '../assessments/scoringService.js';

/**
 * Every figure below is aggregated from real MongoDB records. When a dataset is
 * empty the API returns an explicit `empty: true` flag rather than zeros that
 * could be mistaken for observed measurements.
 */

const FINAL_ATTEMPT_STATES = ['submitted', 'auto_submitted'];

export async function candidateDashboard(candidateId: Types.ObjectId | string) {
  const [user, attempts, profile, reports, roadmaps] = await Promise.all([
    UserModel.findById(candidateId).select('fullName email studentProfile createdAt').lean(),
    AttemptModel.find({ candidate: candidateId }).sort({ createdAt: -1 }).lean(),
    CandidateSkillProfileModel.findOne({ candidate: candidateId }).lean(),
    CareerReportModel.findOne({ candidate: candidateId }).sort({ generatedAt: -1 }).lean(),
    RoadmapModel.find({ candidate: candidateId }).lean(),
  ]);

  const completed = attempts.filter((a) => (FINAL_ATTEMPT_STATES as string[]).includes(a.status));
  const live = attempts.filter((a) => a.status === 'in_progress');
  const measurements = profile?.measurements ?? [];

  const byCategory = new Map<string, { completed: number; average: number; total: number }>();
  for (const attempt of completed) {
    if (attempt.assessmentCategory === 'personality') continue;
    const entry = byCategory.get(attempt.assessmentCategory) ?? { completed: 0, average: 0, total: 0 };
    entry.completed += 1;
    entry.total += attempt.percentage;
    entry.average = entry.total / entry.completed;
    byCategory.set(attempt.assessmentCategory, entry);
  }

  const sortedSkills = [...measurements].sort((a, b) => b.score - a.score);

  return {
    candidate: user
      ? {
          id: String(user._id),
          fullName: user.fullName,
          profileCompletion: user.studentProfile?.completionPercent ?? 0,
          batch: user.studentProfile?.batch ?? null,
          department: user.studentProfile?.department ?? null,
        }
      : null,
    summary: {
      assessmentsCompleted: completed.length,
      assessmentsInProgress: live.length,
      totalAssessmentsAttempted: attempts.length,
      reportsGenerated: reports ? 1 : 0,
      roadmapsActive: roadmaps.length,
      skillsMeasured: measurements.length,
      averageObjectiveScore:
        completed.filter((a) => a.assessmentCategory !== 'personality').length > 0
          ? round(
              completed
                .filter((a) => a.assessmentCategory !== 'personality')
                .reduce((sum, a) => sum + a.percentage, 0) /
                completed.filter((a) => a.assessmentCategory !== 'personality').length,
              1,
            )
          : null,
      catalogueCoverage: profile?.catalogueCoverage ?? 0,
    },
    categoryPerformance: [...byCategory.entries()].map(([category, value]) => ({
      category,
      completed: value.completed,
      averagePercentage: round(value.average, 1),
    })),
    recentAttempts: attempts.slice(0, 8).map((a) => ({
      id: String(a._id),
      assessmentTitle: a.assessmentTitle,
      category: a.assessmentCategory,
      status: a.status,
      percentage: a.assessmentCategory === 'personality' ? null : a.percentage,
      submittedAt: a.submittedAt,
    })),
    topSkills: sortedSkills.slice(0, 6).map((m) => ({ code: m.skillCode, name: m.skillName, score: m.score })),
    weakestMeasuredSkills: sortedSkills
      .slice(-5)
      .reverse()
      .map((m) => ({ code: m.skillCode, name: m.skillName, score: m.score })),
    preferenceProfile: reports?.preferenceProfile ?? [],
    topRecommendations: (reports?.recommendations ?? []).slice(0, 3).map((r) => ({
      careerId: String(r.career),
      slug: r.careerSlug,
      title: r.careerTitle,
      compatibilityScore: r.compatibilityScore,
      confidence: r.confidence,
    })),
    latestReport: reports
      ? { id: reports.reportNumber, generatedAt: reports.generatedAt, scoringVersion: reports.scoringVersion }
      : null,
    roadmapProgress: roadmaps.map((r) => ({
      id: String(r._id),
      careerId: String(r.career),
      title: r.title,
      progressPercent: r.progressPercent,
    })),
    isEmpty: completed.length === 0 && measurements.length === 0,
  };
}

export async function skillProgression(candidateId: Types.ObjectId | string) {
  const profile = await CandidateSkillProfileModel.findOne({ candidate: candidateId }).lean();
  if (!profile || profile.measurements.length === 0) {
    return { empty: true, revisions: [], skills: [], message: 'No skill measurements have been recorded yet.' };
  }

  const measurements = profile.measurements
    .filter((m) => (m.history?.length ?? 0) >= 1)
    .map((m) => ({
      skillCode: m.skillCode,
      skillName: m.skillName,
      currentScore: m.score,
      observations: m.observations,
      // Only plot a trend when there is genuine change across observations.
      change: (m.history?.length ?? 0) > 1 ? round(m.history![m.history!.length - 1].score - m.history![0].score, 1) : null,
      history: (m.history ?? []).map((h) => ({
        attempt: String(h.attempt),
        assessmentTitle: h.assessmentTitle,
        score: h.score,
        at: h.at,
      })),
    }));

  return {
    empty: false,
    revision: profile.revision,
    totalCompletedAssessments: profile.totalCompletedAssessments,
    skills: measurements,
    multiObservationSkills: measurements.filter((m) => m.history.length > 1).length,
    note:
      measurements.filter((m) => m.history.length > 1).length === 0
        ? 'Only one observation exists per skill so far, so no progression trend can be shown. Complete a further assessment to see change over time.'
        : undefined,
  };
}

export async function attemptTrend(months = 12, batch?: string) {
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  const candidateFilter = batch ? [{ 'studentProfile.batch': batch }] : [];
  const candidates = await UserModel.find({ role: 'student', ...(candidateFilter[0] ?? {}) })
    .select('_id')
    .lean();
  const candidateIds = candidates.map((c) => c._id);

  const attempts = await AttemptModel.find({
    candidate: { $in: candidateIds },
    status: { $in: FINAL_ATTEMPT_STATES },
    submittedAt: { $gte: since },
  })
    .select('submittedAt percentage assessmentCategory')
    .lean();

  const buckets = new Map<string, { completed: number; scoreSum: number; scored: number }>();
  for (let i = months - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    buckets.set(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`, {
      completed: 0,
      scoreSum: 0,
      scored: 0,
    });
  }

  for (const attempt of attempts) {
    if (!attempt.submittedAt) continue;
    const key = `${attempt.submittedAt.getFullYear()}-${String(attempt.submittedAt.getMonth() + 1).padStart(2, '0')}`;
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.completed += 1;
    if (attempt.assessmentCategory !== 'personality') {
      bucket.scoreSum += attempt.percentage;
      bucket.scored += 1;
    }
  }

  return [...buckets.entries()].map(([month, value]) => ({
    month,
    completed: value.completed,
    averageScore: value.scored > 0 ? round(value.scoreSum / value.scored, 1) : null,
  }));
}

export async function counsellorAnalytics(
  counsellorId: Types.ObjectId | string,
  filters: { batch?: string; department?: string } = {},
) {
  const studentFilter: Record<string, unknown> = { role: 'student', assignedCounsellor: counsellorId };
  if (filters.batch) studentFilter['studentProfile.batch'] = filters.batch;
  if (filters.department) studentFilter['studentProfile.department'] = filters.department;

  const students = await UserModel.find(studentFilter).select('_id studentProfile').lean();
  const studentIds = students.map((s) => s._id);

  const [attempts, reports] = await Promise.all([
    AttemptModel.find({ candidate: { $in: studentIds }, status: { $in: FINAL_ATTEMPT_STATES } })
      .select('assessmentCategory percentage assessmentTitle candidate')
      .lean(),
    CareerReportModel.find({ candidate: { $in: studentIds } })
      .select('recommendations candidate')
      .lean(),
  ]);

  const studentsWithProgress = new Set(attempts.map((a) => String(a.candidate))).size;
  const perStudent = new Map<string, number>();
  for (const attempt of attempts) {
    perStudent.set(String(attempt.candidate), (perStudent.get(String(attempt.candidate)) ?? 0) + 1);
  }

  const byCategory = new Map<string, { completed: number; scoreSum: number }>();
  for (const attempt of attempts) {
    if (attempt.assessmentCategory === 'personality') continue;
    const entry = byCategory.get(attempt.assessmentCategory) ?? { completed: 0, scoreSum: 0 };
    entry.completed += 1;
    entry.scoreSum += attempt.percentage;
    byCategory.set(attempt.assessmentCategory, entry);
  }

  const careerInterest = new Map<string, number>();
  for (const report of reports) {
    const top = [...(report.recommendations ?? [])]
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
      .slice(0, 1);
    for (const rec of top) {
      careerInterest.set(rec.careerTitle, (careerInterest.get(rec.careerTitle) ?? 0) + 1);
    }
  }

  const needAttention = [...perStudent.entries()]
    .map(([candidateId, count]) => ({ candidateId, count }))
    .filter((entry) => entry.count <= 1)
    .map((entry) => ({ candidateId: entry.candidateId, completedAssessments: entry.count }));

  return {
    scope: { counsellorId: String(counsellorId), batch: filters.batch ?? null, department: filters.department ?? null },
    summary: {
      assignedStudents: students.length,
      studentsWithProgress,
      studentsWithoutAnyAssessment: students.length - studentsWithProgress,
      completedAssessments: attempts.length,
      studentsWithReports: new Set(reports.map((r) => String(r.candidate))).size,
      overallAverageScore: (() => {
        const scored = attempts.filter((a) => a.assessmentCategory !== 'personality');
        if (scored.length === 0) return null;
        return round(scored.reduce((sum, a) => sum + a.percentage, 0) / scored.length, 1);
      })(),
    },
    categoryPerformance: [...byCategory.entries()].map(([category, value]) => ({
      category,
      completed: value.completed,
      averagePercentage: round(value.scoreSum / value.completed, 1),
    })),
    mostCommonTopCareer: [...careerInterest.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([career, count]) => ({ career, count })),
    studentsNeedingAttention: needAttention.slice(0, 20),
    isEmpty: students.length === 0,
  };
}

export async function institutionAnalytics(
  filters: { batch?: string; department?: string; includeCareerInterest?: boolean } = {},
) {
  const studentFilter: Record<string, unknown> = { role: 'student' };
  if (filters.batch) studentFilter['studentProfile.batch'] = filters.batch;
  if (filters.department) studentFilter['studentProfile.department'] = filters.department;

  const students = await UserModel.find(studentFilter).select('_id studentProfile').lean();
  const studentIds = students.map((s) => s._id);

  const [attempts, reports, activeCareers] = await Promise.all([
    AttemptModel.find({ candidate: { $in: studentIds }, status: { $in: FINAL_ATTEMPT_STATES } })
      .select('assessmentCategory percentage candidate batch')
      .lean(),
    CareerReportModel.find({ candidate: { $in: studentIds } }).select('recommendations candidate').lean(),
    CareerModel.countDocuments({ isActive: true }),
  ]);

  const totalAvailable = await AssessmentModel.countDocuments({ status: 'published' });
  const studentsWithProgress = new Set(attempts.map((a) => String(a.candidate))).size;
  const studentsWithReports = new Set(reports.map((r) => String(r.candidate))).size;

  const byCategory = new Map<string, { completed: number; scoreSum: number }>();
  for (const attempt of attempts) {
    if (attempt.assessmentCategory === 'personality') continue;
    const entry = byCategory.get(attempt.assessmentCategory) ?? { completed: 0, scoreSum: 0 };
    entry.completed += 1;
    entry.scoreSum += attempt.percentage;
    byCategory.set(attempt.assessmentCategory, entry);
  }

  const batchDistribution = new Map<string, number>();
  for (const student of students) {
    const batch = student.studentProfile?.batch;
    if (batch) batchDistribution.set(batch, (batchDistribution.get(batch) ?? 0) + 1);
  }

  let careerInterest: Array<{ career: string; count: number }> = [];
  if (filters.includeCareerInterest !== false) {
    const interest = new Map<string, number>();
    for (const report of reports) {
      const top = [...(report.recommendations ?? [])].sort((a, b) => b.compatibilityScore - a.compatibilityScore)[0];
      if (top) interest.set(top.careerTitle, (interest.get(top.careerTitle) ?? 0) + 1);
    }
    careerInterest = [...interest.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([career, count]) => ({ career, count }));
  }

  const scoredAttempts = attempts.filter((a) => a.assessmentCategory !== 'personality');

  return {
    scope: { batch: filters.batch ?? null, department: filters.department ?? null },
    summary: {
      totalStudents: students.length,
      studentsWithProgress,
      studentsWithReports,
      totalCompletedAssessments: attempts.length,
      publishedAssessments: totalAvailable,
      activeCareers,
      overallCompletionRate:
        students.length > 0 && totalAvailable > 0
          ? round(Math.min(100, (attempts.length / (students.length * totalAvailable)) * 100), 1)
          : null,
      overallAverageScore:
        scoredAttempts.length > 0
          ? round(scoredAttempts.reduce((sum, a) => sum + a.percentage, 0) / scoredAttempts.length, 1)
          : null,
    },
    categoryPerformance: [...byCategory.entries()].map(([category, value]) => ({
      category,
      completed: value.completed,
      averagePercentage: round(value.scoreSum / value.completed, 1),
    })),
    batchDistribution: [...batchDistribution.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([batch, count]) => ({ batch, count })),
    careerInterest,
    // Aggregate reporting only: no candidate-level records are returned.
    privacyNotice:
      'Figures are aggregate counts only. Individual candidate records, emails and assessment answers are not exposed in management reporting.',
    isEmpty: students.length === 0,
  };
}

export async function systemAnalytics() {
  const [
    totalUsers,
    activeUsers,
    usersByRole,
    totalQuestions,
    activeQuestions,
    totalAssessments,
    publishedAssessments,
    totalAttempts,
    liveAttempts,
    completedAttempts,
    totalReports,
    totalSkills,
    activeCareers,
    recentSecurityEvents,
  ] = await Promise.all([
    UserModel.countDocuments(),
    UserModel.countDocuments({ isActive: true }),
    UserModel.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    QuestionModel.countDocuments(),
    QuestionModel.countDocuments({ isActive: true }),
    AssessmentModel.countDocuments(),
    AssessmentModel.countDocuments({ status: 'published' }),
    AttemptModel.countDocuments(),
    AttemptModel.countDocuments({ status: 'in_progress' }),
    AttemptModel.countDocuments({ status: { $in: FINAL_ATTEMPT_STATES } }),
    CareerReportModel.countDocuments(),
    SkillModel.countDocuments({ isActive: true }),
    CareerModel.countDocuments({ isActive: true }),
    import('../../models/auditLog.js').then((m) =>
      m.AuditLogModel.countDocuments({ severity: { $in: ['warning', 'critical'] }, createdAt: { $gte: new Date(Date.now() - 7 * 86400000) } }),
    ),
  ]);

  const roleCounts = usersByRole.reduce<Record<string, number>>((acc, row) => {
    acc[row._id] = row.count;
    return acc;
  }, {});

  return {
    summary: {
      totalUsers,
      activeUsers,
      totalQuestions,
      activeQuestions,
      totalAssessments,
      publishedAssessments,
      totalAttempts,
      completedAttempts,
      liveAttempts,
      totalReports,
      totalSkills,
      activeCareers,
      recentSecurityEvents,
    },
    usersByRole: Object.entries(roleCounts).map(([role, count]) => ({ role, count })),
    completionRate: totalAttempts > 0 ? round((completedAttempts / totalAttempts) * 100, 1) : null,
  };
}
