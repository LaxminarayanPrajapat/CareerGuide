import { COMPATIBILITY_SCORING_VERSION } from '../../config/constants.js';
import { clamp, round } from '../assessments/scoringService.js';
import { evidenceConfidence } from '../assessments/skillProfileService.js';

/**
 * ============================================================================
 * CAREER COMPATIBILITY SCORE  -  version compatibility-v1.0.0
 * ============================================================================
 *
 * The score is a transparent, reproducible comparison between what the system
 * has *measured* for a candidate and what a career definition *requires*.
 * It is NOT a probability of success, NOT a hiring prediction and NOT a
 * psychometric norm score.
 *
 * INPUTS
 *   For each career requirement r = (skill, requiredLevel, weight, importance):
 *     measured(r)  - 0..100 skill score from the candidate's skill profile
 *     evidence(r)  - amount of assessment evidence behind that score
 *
 * STEP 1 - Evidence damping
 *   confidence(r) = evidence / (evidence + 2), capped at 1
 *   effective(r)  = measured(r) * (0.7 + 0.3 * confidence(r))
 *   Rationale: a measurement from very little evidence is trusted a little
 *   less, but is never discarded and never treated as zero.
 *
 * STEP 2 - Requirement ratio
 *   ratio(r) = min(1, effective(r) / requiredLevel(r))   (0 if unmeasured)
 *
 * STEP 3 - Weighted skill fit with an explicit coverage penalty
 *   numerator(r)   = weight(r) * ratio(r)
 *   denominator     = sum of weight(r) over ALL requirements
 *   dataCoverage    = sum of weight(r) over MEASURED requirements / denominator
 *   skillFitRaw     = sum(numerator(r)) / denominator
 *   skillFit        = skillFitRaw * (0.40 + 0.60 * dataCoverage)
 *   Rationale: an unmeasured skill lowers the score, but a score based on
 *   almost no evidence is damped so that "not yet assessed" is never reported
 *   as "demonstrated weakness".
 *
 * STEP 4 - Aptitude fit
 *   aptitudeFit = weighted mean of measured aptitude dimensions declared by
 *                 the career, normalised by the total declared weight.
 *   If the career declares no aptitude dimensions, this contributes nothing
 *   and the remaining weights are re-normalised.
 *
 * STEP 5 - Preference fit (indicative working preferences, not traits)
 *   preferenceFit = weighted mean of matching preference dimensions.
 *   Same re-normalisation rule as STEP 4.
 *
 * STEP 6 - Final score
 *   components present -> 0.70*skillFit + 0.20*aptitudeFit + 0.10*preferenceFit
 *   aptitudeFit missing -> remaining weights re-normalised (0.875 / 0.125)
 *   neither present      -> 1.00*skillFit
 *   compatibility = round(compatibility * 100)
 *
 * CONFIDENCE
 *   dataCoverage >= 0.70 -> 'good'
 *   dataCoverage >= 0.40 -> 'moderate'
 *   otherwise            -> 'low'
 *
 * MINIMUM DATA
 *   Fewer than one completed assessment, or dataCoverage below 0.15, marks the
 *   result as insufficient evidence for a strong recommendation.
 */

export const SCORING_VERSION = COMPATIBILITY_SCORING_VERSION;

export const SCORING_WEIGHTS = {
  skillFit: 0.7,
  aptitudeFit: 0.2,
  preferenceFit: 0.1,
  coverageFloor: 0.4,
  evidenceHalfPoint: 2,
  evidenceDampingFloor: 0.7,
  minimumDataCoverage: 0.15,
} as const;

export interface CareerRequirementInput {
  skill: string;
  skillCode: string;
  skillName: string;
  requiredLevel: number;
  weight: number;
  importance: 'core' | 'supporting';
  developmentFocus?: string;
}

export interface CareerInput {
  id: string;
  slug: string;
  title: string;
  category: string;
  requiredSkills: CareerRequirementInput[];
  aptitudeFit: Array<{ dimension: string; weight: number }>;
  preferenceFit: Array<{ dimension: string; weight: number }>;
}

export interface CandidateSkillSignal {
  skill: string;
  score: number;
  evidence: number;
}

export interface CandidateProfileInput {
  completedAssessments: number;
  skills: CandidateSkillSignal[];
  aptitudeDimensions: Record<string, number>;
  preferenceDimensions: Record<string, number>;
}

export interface RequirementEvidence {
  requirementIndex: number;
  skill: string;
  skillCode: string;
  skillName: string;
  importance: 'core' | 'supporting';
  requiredLevel: number;
  measuredLevel: number;
  weight: number;
  state: 'measured' | 'unmeasured';
  gap: number;
  ratio: number;
  note: string;
}

export interface CareerMatch {
  careerId: string;
  slug: string;
  title: string;
  category: string;
  compatibilityScore: number;
  confidence: 'low' | 'moderate' | 'good';
  dataCoverage: number;
  skillFitScore: number;
  aptitudeFitScore: number | null;
  preferenceFitScore: number | null;
  evidence: RequirementEvidence[];
  gaps: Array<{ skillCode: string; skillName: string; gap: number; priority: 'high' | 'medium' | 'low' }>;
  strengths: Array<{ skillCode: string; skillName: string; measured: number; required: number }>;
  insufficientData: boolean;
  deterministicSummary: string;
}

export function computeCareerMatch(
  career: CareerInput,
  profile: CandidateProfileInput,
): CareerMatch {
  const measured = new Map(profile.skills.map((s) => [String(s.skill), s]));

  const requirements = career.requiredSkills ?? [];
  const totalWeight = requirements.reduce((sum, r) => sum + Math.max(r.weight, 0), 0) || 1;

  const evidence: RequirementEvidence[] = [];
  let weightedRatio = 0;
  let measuredWeight = 0;

  requirements.forEach((requirement, index) => {
    const signal = measured.get(String(requirement.skill));
    const weight = Math.max(requirement.weight, 0);
    const isMeasured = Boolean(signal && signal.evidence > 0);

    let effective = 0;
    let ratio = 0;
    let gap = requirement.requiredLevel;

    if (isMeasured && signal) {
      const confidence = evidenceConfidence(signal.evidence);
      effective = clamp(signal.score, 0, 100) * (
        SCORING_WEIGHTS.evidenceDampingFloor + (1 - SCORING_WEIGHTS.evidenceDampingFloor) * confidence
      );
      ratio = requirement.requiredLevel <= 0 ? 1 : clamp(effective / requirement.requiredLevel, 0, 1);
      gap = round(Math.max(0, requirement.requiredLevel - effective));
      weightedRatio += weight * ratio;
      measuredWeight += weight;
    }

    evidence.push({
      requirementIndex: index,
      skill: String(requirement.skill),
      skillCode: requirement.skillCode,
      skillName: requirement.skillName,
      importance: requirement.importance,
      requiredLevel: requirement.requiredLevel,
      measuredLevel: round(effective),
      weight: round(weight / totalWeight, 4),
      state: isMeasured ? 'measured' : 'unmeasured',
      gap,
      ratio: round(ratio, 4),
      note: buildNote(requirement, isMeasured, effective, gap, signal?.evidence ?? 0),
    });
  });

  const dataCoverage = round(clamp(measuredWeight / totalWeight, 0, 1), 4);
  const skillFitRaw = totalWeight > 0 ? weightedRatio / totalWeight : 0;
  const skillFit = clamp(
    skillFitRaw * (SCORING_WEIGHTS.coverageFloor + (1 - SCORING_WEIGHTS.coverageFloor) * dataCoverage),
    0,
    1,
  );

  const aptitudeFitScore = weightedDimensionMatch(career.aptitudeFit ?? [], profile.aptitudeDimensions);
  const preferenceFitScore = weightedDimensionMatch(career.preferenceFit ?? [], profile.preferenceDimensions);

  let finalScore: number;
  if (aptitudeFitScore !== null && preferenceFitScore !== null) {
    finalScore =
      SCORING_WEIGHTS.skillFit * skillFit +
      SCORING_WEIGHTS.aptitudeFit * aptitudeFitScore +
      SCORING_WEIGHTS.preferenceFit * preferenceFitScore;
  } else if (aptitudeFitScore !== null) {
    const total = SCORING_WEIGHTS.skillFit + SCORING_WEIGHTS.aptitudeFit;
    finalScore = (SCORING_WEIGHTS.skillFit * skillFit + SCORING_WEIGHTS.aptitudeFit * aptitudeFitScore) / total;
  } else if (preferenceFitScore !== null) {
    const total = SCORING_WEIGHTS.skillFit + SCORING_WEIGHTS.preferenceFit;
    finalScore = (SCORING_WEIGHTS.skillFit * skillFit + SCORING_WEIGHTS.preferenceFit * preferenceFitScore) / total;
  } else {
    finalScore = skillFit;
  }

  const gaps = evidence
    .filter((e) => e.gap > 0.5)
    .map((e) => ({
      skillCode: e.skillCode,
      skillName: e.skillName,
      gap: e.gap,
      priority: priorityFor(e.gap, e.weight, e.importance),
    }))
    .sort((a, b) => b.gap * bWeight(b) - a.gap * bWeight(a))
    .slice(0, 8);

  const strengths = evidence
    .filter((e) => e.state === 'measured' && e.measuredLevel >= e.requiredLevel)
    .sort((a, b) => b.measuredLevel - b.requiredLevel - (a.measuredLevel - a.requiredLevel))
    .slice(0, 6)
    .map((e) => ({ skillCode: e.skillCode, skillName: e.skillName, measured: e.measuredLevel, required: e.requiredLevel }));

  const compatibilityScore = round(clamp(finalScore, 0, 1) * 100, 1);
  const confidence: CareerMatch['confidence'] =
    dataCoverage >= 0.7 ? 'good' : dataCoverage >= 0.4 ? 'moderate' : 'low';
  const insufficientData =
    profile.completedAssessments < 1 || dataCoverage < SCORING_WEIGHTS.minimumDataCoverage;

  return {
    careerId: career.id,
    slug: career.slug,
    title: career.title,
    category: career.category,
    compatibilityScore,
    confidence,
    dataCoverage,
    skillFitScore: round(skillFit * 100, 1),
    aptitudeFitScore: aptitudeFitScore === null ? null : round(aptitudeFitScore * 100, 1),
    preferenceFitScore: preferenceFitScore === null ? null : round(preferenceFitScore * 100, 1),
    evidence,
    gaps,
    strengths,
    insufficientData,
    deterministicSummary: buildSummary({
      compatibilityScore,
      confidence,
      dataCoverage,
      strengths,
      gaps,
      insufficientData,
      unmeasuredCount: evidence.filter((e) => e.state === 'unmeasured').length,
    }),
  };
}

function bWeight(gap: { gap: number; priority: string }): number {
  return gap.priority === 'high' ? 1.5 : gap.priority === 'medium' ? 1 : 0.5;
}

function priorityFor(gap: number, weight: number, importance: string): 'high' | 'medium' | 'low' {
  if (importance === 'core' && gap >= 20) return 'high';
  if (gap >= 30) return 'high';
  if (gap >= 12) return 'medium';
  if (weight > 0.15 && gap >= 6) return 'medium';
  return 'low';
}

function buildNote(
  requirement: CareerRequirementInput,
  isMeasured: boolean,
  effective: number,
  gap: number,
  evidence: number,
): string {
  if (!isMeasured) {
    return `Not yet measured by any completed assessment, so no evidence is available for "${requirement.skillName}". Complete the relevant assessments to obtain a reliable reading.`;
  }
  const evidenceText = evidence >= 10 ? 'well-evidenced' : evidence >= 4 ? 'moderately evidenced' : 'based on limited evidence';
  if (gap <= 0.5) {
    return `Demonstrated level ${round(effective)} meets the required level ${requirement.requiredLevel} (${evidenceText}).`;
  }
  return `${round(effective)} measured versus ${requirement.requiredLevel} required - a gap of ${gap} points (${evidenceText}). ${
    requirement.developmentFocus ? `Focus: ${requirement.developmentFocus}` : ''
  }`.trim();
}

/** Weighted mean over the declared dimensions; null when nothing is declared. */
export function weightedDimensionMatch(
  declared: Array<{ dimension: string; weight: number }>,
  available: Record<string, number>,
): number | null {
  const usable = declared.filter((d) => typeof available[d.dimension] === 'number');
  if (usable.length === 0) return null;
  const totalWeight = usable.reduce((sum, d) => sum + Math.max(d.weight, 0), 0) || 1;
  const total = usable.reduce(
    (sum, d) => sum + clamp(available[d.dimension], 0, 100) * (Math.max(d.weight, 0) / totalWeight),
    0,
  );
  return clamp(total / 100, 0, 1);
}

function buildSummary(input: {
  compatibilityScore: number;
  confidence: CareerMatch['confidence'];
  dataCoverage: number;
  strengths: Array<{ skillName: string }>;
  gaps: Array<{ skillName: string; gap: number; priority: string }>;
  insufficientData: boolean;
  unmeasuredCount: number;
}): string {
  const parts: string[] = [];
  parts.push(
    `Career compatibility score ${input.compatibilityScore} out of 100 (${input.confidence} confidence, ${Math.round(
      input.dataCoverage * 100,
    )}% of this role's requirements measured by your assessments).`,
  );

  if (input.insufficientData) {
    parts.push(
      'This score is based on limited evidence. Complete more assessments before treating it as a reliable guide.',
    );
  }

  if (input.strengths.length > 0) {
    parts.push(
      `You already meet the required level for: ${input.strengths.map((s) => s.skillName).join(', ')}.`,
    );
  }

  if (input.gaps.length > 0) {
    const top = input.gaps.slice(0, 3);
    parts.push(
      `Priority development areas: ${top
        .map((g) => `${g.skillName} (${Math.round(g.gap)} points below the required level)`)
        .join('; ')}.`,
    );
  } else if (input.strengths.length > 0) {
    parts.push('No significant skill gaps were detected against the measured requirements.');
  }

  if (input.unmeasuredCount > 0) {
    parts.push(
      `${input.unmeasuredCount} requirement(s) of this role have not been measured yet and are reported as unknown rather than as weaknesses.`,
    );
  }

  return parts.join(' ');
}

export function rankMatches(matches: CareerMatch[], limit = 6): CareerMatch[] {
  return [...matches]
    .sort((a, b) => {
      if (b.compatibilityScore !== a.compatibilityScore) return b.compatibilityScore - a.compatibilityScore;
      return b.dataCoverage - a.dataCoverage;
    })
    .slice(0, limit);
}
