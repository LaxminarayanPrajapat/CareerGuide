import type { Types } from 'mongoose';
import { CandidateSkillProfileModel, SkillProfileRevisionModel } from '../../models/CandidateSkillProfile.js';
import { SkillModel } from '../../models/Skill.js';
import { logger } from '../../utils/logger.js';
import { normalisePercentage, round } from './scoringService.js';

export interface AttemptSkillMeasurement {
  skill: string;
  skillCode?: string;
  skillName?: string;
  score: number;
  evidence: number;
}

/**
 * Merges the measurements produced by a completed attempt into the candidate's
 * skill profile.
 *
 * The running level is an evidence-weighted mean, so a single short test does
 * not overwrite a well-evidenced earlier measurement, and a later assessment
 * always moves the level towards the newly observed value:
 *
 *   newScore = (oldScore * oldEvidence + observedScore * gainedEvidence)
 *              / (oldEvidence + gainedEvidence)
 *
 * `gainedEvidence` is the number of marks that produced the measurement, which
 * keeps longer tests proportionally more influential.
 */
export async function applyAttemptToSkillProfile(options: {
  candidateId: Types.ObjectId | string;
  attemptId: Types.ObjectId | string;
  assessmentId: Types.ObjectId | string;
  assessmentTitle: string;
  measurements: AttemptSkillMeasurement[];
}): Promise<{ revision: number; updatedSkills: number }> {
  const { candidateId, attemptId, assessmentId, assessmentTitle, measurements } = options;

  if (measurements.length === 0) {
    const existing = await CandidateSkillProfileModel.findOneAndUpdate(
      { candidate: candidateId },
      {
        $inc: { revision: 1, totalCompletedAssessments: 1 },
        $set: { lastUpdatedAt: new Date() },
      },
      { new: true },
    );
    const revision = existing?.revision ?? 1;
    await snapshotRevision({
      candidateId,
      revision,
      reason: 'Assessment completed (no measurable skills)',
      attemptId,
      assessmentId,
    });
    return { revision, updatedSkills: 0 };
  }

  const skillIds = measurements.map((m) => m.skill);
  const skills = await SkillModel.find({ _id: { $in: skillIds } }).select('code name category').lean();
  const skillMeta = new Map(skills.map((s) => [String(s._id), s]));

  const profile =
    (await CandidateSkillProfileModel.findOne({ candidate: candidateId })) ??
    (await CandidateSkillProfileModel.create({ candidate: candidateId, measurements: [], revision: 1 }));

  const index = new Map(profile.measurements.map((m, i) => [String(m.skill), i]));
  const now = new Date();

  for (const measurement of measurements) {
    const meta = skillMeta.get(measurement.skill);
    const observed = round(Math.max(0, Math.min(100, measurement.score)));
    const evidence = Math.max(0, measurement.evidence);

    if (evidence <= 0 && index.get(measurement.skill) === undefined) continue;

    const position = index.get(measurement.skill);
    if (position === undefined) {
      profile.measurements.push({
        skill: measurement.skill as never,
        skillCode: measurement.skillCode ?? meta?.code ?? '',
        skillName: measurement.skillName ?? meta?.name ?? '',
        category: meta?.category ?? 'technical',
        score: observed,
        evidence,
        observations: 1,
        lastUpdatedAt: now,
        history: [
          {
            attempt: attemptId as never,
            assessment: assessmentId as never,
            assessmentTitle,
            score: observed,
            gainedEvidence: evidence,
            at: now,
          },
        ],
      } as never);
      index.set(measurement.skill, profile.measurements.length - 1);
      continue;
    }

    const current = profile.measurements[position];
    const oldEvidence = Math.max(current.evidence ?? 0, 0);
    const totalEvidence = oldEvidence + evidence;
    const combined =
      totalEvidence > 0 ? (current.score * oldEvidence + observed * evidence) / totalEvidence : observed;

    current.score = round(Math.max(0, Math.min(100, combined)));
    current.evidence = round(totalEvidence);
    current.observations = (current.observations ?? 0) + 1;
    current.lastUpdatedAt = now;
    current.history = [
      ...(current.history ?? []),
      {
        attempt: attemptId as never,
        assessment: assessmentId as never,
        assessmentTitle,
        score: observed,
        gainedEvidence: evidence,
        at: now,
      },
    ] as never;
  }

  // Keep each skill's history bounded so a document cannot grow without limit.
  for (const measurement of profile.measurements) {
    if ((measurement.history?.length ?? 0) > 20) {
      measurement.history = measurement.history.slice(-20) as never;
    }
  }

  const activeSkillCount = await SkillModel.countDocuments({ isActive: true });
  const measuredCount = profile.measurements.length;
  profile.catalogueCoverage =
    activeSkillCount > 0 ? round(Math.min(1, measuredCount / activeSkillCount), 4) : 0;
  profile.totalCompletedAssessments = (profile.totalCompletedAssessments ?? 0) + 1;
  profile.revision = (profile.revision ?? 1) + 1;
  profile.lastUpdatedAt = now;

  await profile.save();

  await snapshotRevision({
    candidateId,
    revision: profile.revision,
    reason: `Assessment completed: ${assessmentTitle}`,
    attemptId,
    assessmentId,
  });

  return { revision: profile.revision, updatedSkills: measurements.length };
}

async function snapshotRevision(options: {
  candidateId: Types.ObjectId | string;
  revision: number;
  reason: string;
  attemptId?: Types.ObjectId | string;
  assessmentId?: Types.ObjectId | string;
}): Promise<void> {
  try {
    const profile = await CandidateSkillProfileModel.findOne({ candidate: options.candidateId })
      .select('measurements catalogueCoverage')
      .lean();
    if (!profile) return;

    await SkillProfileRevisionModel.updateOne(
      { candidate: options.candidateId, revision: options.revision },
      {
        $setOnInsert: {
          candidate: options.candidateId,
          revision: options.revision,
          reason: options.reason,
          triggerAttempt: options.attemptId,
          triggerAssessment: options.assessmentId,
          catalogueCoverage: profile.catalogueCoverage ?? 0,
          snapshot: profile.measurements.map((m) => ({
            skill: m.skill,
            skillCode: m.skillCode,
            skillName: m.skillName,
            score: m.score,
            evidence: m.evidence,
            observations: m.observations,
          })),
        },
      },
      { upsert: true },
    );
  } catch (error) {
    logger.warn('skillProfile.revision_snapshot_failed', { message: (error as Error).message });
  }
}

export interface SkillEvidenceSignal {
  score: number;
  evidence: number;
  /**
   * Confidence in the 0..1 range derived from how much evidence stands behind
   * the measurement. Used to damp low-evidence scores, never to zero them.
   */
  confidence: number;
  measured: boolean;
}

/**
 * Confidence curve: full confidence at 10 marks of evidence, 50% confidence at
 * 2 marks. Deterministic and documented so scoring is reproducible.
 */
export function evidenceConfidence(evidence: number): number {
  const CONFIDENCE_CEILING = 10;
  const HALF_EVIDENCE = 2;
  if (evidence <= 0) return 0;
  if (evidence >= CONFIDENCE_CEILING) return 1;
  return round(Math.min(1, evidence / (evidence + HALF_EVIDENCE)), 4);
}

export function toSignal(score: number, evidence: number): SkillEvidenceSignal {
  return {
    score: round(score),
    evidence: round(evidence),
    confidence: evidenceConfidence(evidence),
    measured: evidence > 0,
  };
}

export { normalisePercentage };
