import type { Types } from 'mongoose';
import { COMPATIBILITY_SCORING_VERSION } from '../../config/constants.js';
import { AttemptModel } from '../../models/Attempt.js';
import { CandidateSkillProfileModel } from '../../models/CandidateSkillProfile.js';
import { CareerModel } from '../../models/Career.js';
import { CareerReportModel } from '../../models/CareerReport.js';
import { RoadmapModel } from '../../models/Roadmap.js';
import { SkillModel } from '../../models/Skill.js';
import { UserModel } from '../../models/User.js';
import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../../utils/logger.js';
import { round } from '../assessments/scoringService.js';
import {
  computeCareerMatch,
  rankMatches,
  type CareerInput,
  type CareerMatch,
  type CandidateProfileInput,
} from '../careers/compatibilityService.js';
import { generateNarrative, type AiNarrative } from '../ai/aiProviderRegistry.js';
import { buildRoadmap } from './roadmapService.js';

export const REPORT_DISCLAIMER = [
  'This report is indicative guidance produced from the assessments you completed in this system.',
  'A career compatibility score compares your measured competencies with a career definition. It is not a probability of getting a job, a hiring decision, or a guarantee of success in any profession.',
  'Personality results describe indicative working preferences only. They are not psychological, clinical or diagnostic findings and must not be used as such.',
  'Recommendations depend on the quality and coverage of the assessments, the accuracy of the career catalogue, and the scoring assumptions documented for version ' +
    COMPATIBILITY_SCORING_VERSION +
    '.',
  'Discuss this report with a qualified counsellor before making academic or career decisions.',
].join(' ');

export interface GenerateReportOptions {
  candidateId: Types.ObjectId | string;
  generatedBy: Types.ObjectId | string;
  includeRoadmaps?: boolean;
  roadmapCount?: number;
  forceRegenerate?: boolean;
  /** Injectable for testing; defaults to the configured AI provider. */
  narrativeGenerator?: typeof generateNarrative;
}

export interface GenerateReportResult {
  reportId: string;
  reused: boolean;
  aiProviderUsed: string;
  aiAvailable: boolean;
  aiFailureReason?: string;
  recommendations: Array<{ slug: string; title: string; compatibilityScore: number }>;
  dataCoverage: number;
  completedAssessments: number;
  roadmapIds: string[];
}

/** Builds the deterministic candidate profile consumed by the scorer. */
export async function buildCandidateProfile(candidateId: Types.ObjectId | string): Promise<CandidateProfileInput> {
  const [profile, attempts] = await Promise.all([
    CandidateSkillProfileModel.findOne({ candidate: candidateId }).lean(),
    AttemptModel.find({
      candidate: candidateId,
      status: { $in: ['submitted', 'auto_submitted'] },
    })
      .select('assessmentCategory preferenceResults')
      .lean(),
  ]);

  const skills = (profile?.measurements ?? []).map((m) => ({
    skill: String(m.skill),
    score: m.score,
    evidence: m.evidence,
  }));

  // Preference dimensions come from completed personality instruments only.
  const preferenceDimensions: Record<string, number> = {};
  for (const attempt of attempts) {
    for (const preference of attempt.preferenceResults ?? []) {
      if (!preference.dimension) continue;
      const previous = preferenceDimensions[preference.dimension];
      // Evidence-weighted mean so repeated instruments converge rather than overwrite.
      preferenceDimensions[preference.dimension] = previous === undefined
        ? preference.normalisedScore
        : round((previous + preference.normalisedScore) / 2, 2);
    }
  }

  // Aptitude dimensions are the aptitude / reasoning skills measured objectively.
  const aptitudeSkillIds = await SkillModel.find({
    category: 'aptitude',
    isActive: true,
  })
    .select('_id')
    .lean();
  const aptitudeIdSet = new Set(aptitudeSkillIds.map((s) => String(s._id)));

  const aptitudeDimensions: Record<string, number> = {};
  for (const skill of skills) {
    if (aptitudeIdSet.has(skill.skill)) {
      aptitudeDimensions[skill.skill] = skill.score;
    }
  }

  // Preference scores are also exposed as preference "skills" for career matching.
  for (const [dimension, score] of Object.entries(preferenceDimensions)) {
    aptitudeDimensions[`preference:${dimension}`] = score;
  }

  return {
    completedAssessments: profile?.totalCompletedAssessments ?? attempts.length,
    skills,
    aptitudeDimensions,
    preferenceDimensions,
  };
}

export async function loadActiveCareers(): Promise<CareerInput[]> {
  const careers = await CareerModel.find({ isActive: true }).lean();
  return careers.map((career) => ({
    id: String(career._id),
    slug: career.slug,
    title: career.title,
    category: career.category,
    requiredSkills: (career.requiredSkills ?? []).map((r) => ({
      skill: String(r.skill),
      skillCode: r.skillCode ?? '',
      skillName: r.skillName ?? '',
      requiredLevel: r.requiredLevel,
      weight: r.weight,
      importance: r.importance,
      developmentFocus: r.developmentFocus,
    })),
    aptitudeFit: career.aptitudeFit ?? [],
    preferenceFit: career.preferenceFit ?? [],
  }));
}

/**
 * Runs the full pipeline: gather evidence -> deterministic scoring -> optional
 * AI explanation -> persistence. Every stage is unit-testable in isolation.
 */
export async function generateCareerReport(options: GenerateReportOptions): Promise<GenerateReportResult> {
  const {
    candidateId,
    generatedBy,
    includeRoadmaps = true,
    roadmapCount = 3,
    forceRegenerate = false,
    narrativeGenerator = generateNarrative,
  } = options;

  const candidate = await UserModel.findById(candidateId).select('fullName email role studentProfile.batch');
  if (!candidate) throw ApiError.notFound('Candidate not found.');

  if (!forceRegenerate) {
    const latest = await CareerReportModel.findOne({ candidate: candidateId })
      .sort({ generatedAt: -1 })
      .lean();
    if (
      latest &&
      latest.scoringVersion === COMPATIBILITY_SCORING_VERSION &&
      latest.generationStatus === 'completed' &&
      latest.skillProfileRevision === (await currentRevision(candidateId))
    ) {
      return {
        reportId: latest.reportNumber,
        reused: true,
        aiProviderUsed: latest.aiProviderUsed,
        aiAvailable: latest.aiProviderUsed !== 'none',
        aiFailureReason: latest.aiFailureReason,
        recommendations: (latest.recommendations ?? []).map((r) => ({
          slug: r.careerSlug,
          title: r.careerTitle,
          compatibilityScore: r.compatibilityScore,
        })),
        dataCoverage: latest.dataCoverage,
        completedAssessments: latest.completedAssessments,
        roadmapIds: [],
      };
    }
  }

  const [profile, careers, profileDoc, completedAttempts] = await Promise.all([
    buildCandidateProfile(candidateId),
    loadActiveCareers(),
    CandidateSkillProfileModel.findOne({ candidate: candidateId }).lean(),
    AttemptModel.find({
      candidate: candidateId,
      status: { $in: ['submitted', 'auto_submitted'] },
    })
      .sort({ submittedAt: -1 })
      .select('_id assessment assessmentTitle assessmentCategory percentage submittedAt')
      .lean(),
  ]);

  if (careers.length === 0) {
    throw ApiError.unprocessable('The career catalogue is empty, so no recommendation can be produced.');
  }

  const matches: CareerMatch[] = careers.map((career) => computeCareerMatch(career, profile));
  const ranked = rankMatches(matches, Math.max(3, roadmapCount));

  const measurements = profileDoc?.measurements ?? [];
  const measuredSkills = [...measurements].sort((a, b) => b.score - a.score);

  const preferenceProfile = completedAttempts
    .flatMap((a) => (a as { preferenceResults?: unknown[] }).preferenceResults ?? [])
    .reduce<Array<{ dimension: string; score: number; itemsAnswered: number }>>((acc, entry) => {
      const item = entry as { dimension: string; normalisedScore: number; itemsAnswered: number };
      const existing = acc.find((a) => a.dimension === item.dimension);
      if (existing) {
        existing.score = round((existing.score + item.normalisedScore) / 2, 2);
        existing.itemsAnswered += item.itemsAnswered;
      } else {
        acc.push({ dimension: item.dimension, score: item.normalisedScore, itemsAnswered: item.itemsAnswered });
      }
      return acc;
    }, []);

  const measuredCodes = new Set(measurements.map((m) => m.skillCode));
  const unmeasuredSkillCodes = [
    ...new Set(
      careers.flatMap((c) =>
        c.requiredSkills
          .filter((r) => !measuredCodes.has(r.skillCode))
          .map((r) => r.skillCode),
      ),
    ),
  ].filter(Boolean).slice(0, 40);

  const aiInput = {
    candidateSummary: {
      completedAssessments: profile.completedAssessments,
      dataCoverage: profileDoc?.catalogueCoverage ?? 0,
      skills: measurements.map((m) => ({
        code: m.skillCode,
        name: m.skillName,
        score: m.score,
        evidence: m.evidence,
      })),
      strongest: measuredSkills.slice(0, 5).map((m) => ({ code: m.skillCode, name: m.skillName, score: m.score })),
      weakest: measuredSkills.slice(-5).reverse().map((m) => ({ code: m.skillCode, name: m.skillName, score: m.score })),
      unmeasured: unmeasuredSkillCodes.slice(0, 15),
      preferences: preferenceProfile,
    },
    careers: ranked.map((match) => ({
      slug: match.slug,
      title: match.title,
      compatibilityScore: match.compatibilityScore,
      confidence: match.confidence,
      dataCoverage: match.dataCoverage,
      matched: match.strengths.map((s) => s.skillName),
      gaps: match.gaps.slice(0, 4).map((g) => ({ name: g.skillName, gap: g.gap })),
      unmeasured: match.evidence.filter((e) => e.state === 'unmeasured').map((e) => e.skillName),
    })),
  };

  let narrative: AiNarrative | null = null;
  let aiProviderUsed = 'none';
  let aiFailureReason: string | undefined;
  let aiLatencyMs: number | undefined;

  try {
    const outcome = await narrativeGenerator(aiInput);
    narrative = outcome.narrative;
    aiProviderUsed = outcome.provider;
    aiFailureReason = outcome.failureReason;
    aiLatencyMs = outcome.latencyMs;
  } catch (error) {
    aiFailureReason = (error as Error).message;
    logger.warn('ai.narrative_failed', { candidateId: String(candidateId), reason: aiFailureReason });
  }

  // Defence in depth: strip any career reference the model produced that is not
  // in the ranked set. This runs here as well as in the provider wrapper, so the
  // invariant holds no matter which generator is supplied.
  const allowedSlugs = new Set(ranked.map((match) => match.slug));
  if (narrative) {
    narrative.careerRationale = Object.fromEntries(
      Object.entries(narrative.careerRationale ?? {}).filter(([slug]) => allowedSlugs.has(slug)),
    );
    narrative.roadmapGuidance = Object.fromEntries(
      Object.entries(narrative.roadmapGuidance ?? {}).filter(([slug]) => allowedSlugs.has(slug)),
    );
    // A narrative that references nothing usable is treated as no narrative.
    if (Object.keys(narrative.careerRationale).length === 0) {
      aiFailureReason = aiFailureReason ?? 'The AI narrative referenced no known career.';
      narrative = null;
    }
  }

  // The deterministic summary is always present; AI text only enriches it.
  const recommendations = ranked.map((match) => ({
    career: match.careerId,
    careerSlug: match.slug,
    careerTitle: match.title,
    careerCategory: match.category,
    compatibilityScore: match.compatibilityScore,
    confidence: match.confidence,
    dataCoverage: match.dataCoverage,
    skillFitScore: match.skillFitScore,
    aptitudeFitScore: match.aptitudeFitScore ?? 0,
    preferenceFitScore: match.preferenceFitScore ?? 0,
    evidence: match.evidence,
    deterministicSummary: match.deterministicSummary,
    aiExplanation: narrative?.careerRationale?.[match.slug],
    topGaps: match.gaps.slice(0, 5).map((g) => ({
      skillCode: g.skillCode,
      skillName: g.skillName,
      gap: g.gap,
      priority: g.priority,
    })),
  }));

  const report = await CareerReportModel.create({
    candidate: candidateId,
    reportNumber: await nextReportNumber(candidateId),
    scoringVersion: COMPATIBILITY_SCORING_VERSION,
    inputAttemptIds: completedAttempts.map((a) => a._id),
    inputAssessments: completedAttempts.slice(0, 25).map((a) => ({
      assessment: a.assessment,
      title: a.assessmentTitle,
      category: a.assessmentCategory,
      percentage: a.assessmentCategory === 'personality' ? 0 : a.percentage,
    })),
    skillProfileRevision: profileDoc?.revision ?? 1,
    dataCoverage: profileDoc?.catalogueCoverage ?? 0,
    completedAssessments: profile.completedAssessments,
    skillSnapshot: measurements.map((m) => ({
      skill: m.skill,
      skillCode: m.skillCode,
      skillName: m.skillName,
      score: m.score,
      evidence: m.evidence,
    })),
    strongestSkills: measuredSkills.slice(0, 6).map((m) => ({
      skillCode: m.skillCode,
      skillName: m.skillName,
      score: m.score,
    })),
    weakestSkills: measuredSkills
      .slice(-6)
      .reverse()
      .map((m) => ({ skillCode: m.skillCode, skillName: m.skillName, score: m.score })),
    unmeasuredSkillCodes,
    recommendations,
    preferenceProfile,
    aiNarrative: narrative ?? undefined,
    generationStatus: 'completed',
    aiProviderUsed,
    aiFailureReason,
    aiLatencyMs,
    disclaimer: REPORT_DISCLAIMER,
    generatedBy,
  });

  const roadmapIds: string[] = [];
  if (includeRoadmaps) {
    const careerDocs = await CareerModel.find({
      _id: { $in: ranked.map((m) => m.careerId) },
    });
    for (const match of ranked.slice(0, roadmapCount)) {
      const career = careerDocs.find((c) => String(c._id) === match.careerId);
      if (!career) continue;
      const roadmap = await buildRoadmap({
        candidateId,
        careerId: career._id,
        reportId: report._id,
        reportNumber: report.reportNumber,
        createdBy: generatedBy,
        match,
        careerDoc: career.toObject(),
      });
      roadmapIds.push(String(roadmap._id));
    }
  }

  return {
    reportId: report.reportNumber,
    reused: false,
    aiProviderUsed,
    aiAvailable: narrative !== null,
    aiFailureReason,
    recommendations: recommendations.map((r) => ({
      slug: r.careerSlug,
      title: r.careerTitle,
      compatibilityScore: r.compatibilityScore,
    })),
    dataCoverage: profileDoc?.catalogueCoverage ?? 0,
    completedAssessments: profile.completedAssessments,
    roadmapIds,
  };
}

async function currentRevision(candidateId: Types.ObjectId | string): Promise<number> {
  const profile = await CandidateSkillProfileModel.findOne({ candidate: candidateId })
    .select('revision')
    .lean();
  return profile?.revision ?? 1;
}

async function nextReportNumber(candidateId: Types.ObjectId | string): Promise<string> {
  const count = await CareerReportModel.countDocuments({ candidate: candidateId });
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `CGR-${stamp}-${String(count + 1).padStart(4, '0')}`;
}

export { generateNarrative };
