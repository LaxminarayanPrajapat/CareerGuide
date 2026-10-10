import { PREFERENCE_DIMENSIONS } from '../../config/constants.js';

export interface ScorableOption {
  optionId: string;
  text: string;
  preferencePoints?: number;
}

export interface ScorableQuestion {
  _id: unknown;
  text: string;
  questionType: 'mcq' | 'likert';
  options: ScorableOption[];
  correctOptionId?: string;
  preferenceDimension?: string;
  marks: number;
  skillMappings: Array<{ skill: unknown; weight: number }>;
}

export interface ScoredAnswer {
  questionId: string;
  selectedOptionId?: string;
  marksAwarded: number;
  marksPossible: number;
  isCorrect: boolean;
  evaluationStatus: 'scored' | 'preference' | 'invalid' | 'unanswered';
  invalidReason?: string;
  skillContributions: Array<{ skill: string; marksObtained: number; marksPossible: number }>;
  preferenceContribution?: { dimension: string; points: number; maxPoints: number };
}

/**
 * Deterministic scoring for a single attempt.
 *
 * Objective items (MCQ): the configured answer key decides the award. Items
 * without a valid key are marked `invalid` and excluded from the total - the
 * scorer never invents a correct answer.
 *
 * Personality items: each response contributes points to a declared preference
 * dimension. Points are aggregated into normalised preference scores and are
 * never treated as right or wrong.
 */
export class AttemptScorer {
  private readonly invalidQuestions: Array<{ questionId: string; reason: string }> = [];

  constructor(private readonly questions: ScorableQuestion[]) {}

  score(responses: Map<string, string | undefined>): {
    answers: ScoredAnswer[];
    marksObtained: number;
    totalMarks: number;
    scorableMarks: number;
    invalidQuestions: Array<{ questionId: string; reason: string }>;
    answeredCount: number;
  } {
    const answers: ScoredAnswer[] = [];
    let marksObtained = 0;
    let scorableMarks = 0;

    for (const question of this.questions) {
      const questionId = String(question._id);
      const selected = responses.get(questionId);
      const marks = question.marks;

      if (selected === undefined || selected === null || selected === '') {
        // Unanswered items contribute zero to scored skills but keep their marks
        // in the denominator so the percentage reflects actual performance.
        if (question.questionType === 'mcq' && this.mcqValidity(question).valid) {
          marksObtained += 0;
          scorableMarks += marks;
        }
        answers.push({
          questionId,
          selectedOptionId: undefined,
          marksAwarded: 0,
          marksPossible: marks,
          isCorrect: false,
          evaluationStatus: 'unanswered',
          skillContributions: this.spreadMarks(question, 0, marks),
        });
        continue;
      }

      const option = question.options.find((o) => o.optionId === selected);
      if (!option) {
        // A response that does not correspond to any option is malformed input.
        this.invalidQuestions.push({
          questionId,
          reason: 'Selected option is not part of this item.',
        });
        answers.push({
          questionId,
          selectedOptionId: selected,
          marksAwarded: 0,
          marksPossible: marks,
          isCorrect: false,
          evaluationStatus: 'invalid',
          invalidReason: 'Selected option is not part of this item.',
          skillContributions: [],
        });
        continue;
      }

      if (question.questionType === 'mcq') {
        const validity = this.mcqValidity(question);
        if (!validity.valid) {
          this.invalidQuestions.push({ questionId, reason: validity.reason! });
          answers.push({
            questionId,
            selectedOptionId: selected,
            marksAwarded: 0,
            marksPossible: 0,
            isCorrect: false,
            evaluationStatus: 'invalid',
            invalidReason: validity.reason,
            skillContributions: [],
          });
          continue;
        }
        const correct = selected === question.correctOptionId;
        const awarded = correct ? marks : 0;
        marksObtained += awarded;
        scorableMarks += marks;
        answers.push({
          questionId,
          selectedOptionId: selected,
          marksAwarded: awarded,
          marksPossible: marks,
          isCorrect: correct,
          evaluationStatus: 'scored',
          skillContributions: this.spreadMarks(question, awarded, marks),
        });
        continue;
      }

      // Personality / work-preference item.
      const dimension = question.preferenceDimension;
      if (!dimension || !PREFERENCE_DIMENSIONS.includes(dimension as never)) {
        this.invalidQuestions.push({
          questionId,
          reason: 'Preference item has no valid dimension declared.',
        });
        answers.push({
          questionId,
          selectedOptionId: selected,
          marksAwarded: 0,
          marksPossible: 0,
          isCorrect: false,
          evaluationStatus: 'invalid',
          invalidReason: 'Preference item has no valid dimension declared.',
          skillContributions: [],
        });
        continue;
      }

      const points = option.preferencePoints ?? 0;
      const maxPoints = Math.max(
        ...question.options.map((o) => o.preferencePoints ?? 0),
        0,
      );
      answers.push({
        questionId,
        selectedOptionId: selected,
        marksAwarded: 0,
        marksPossible: 0,
        isCorrect: false,
        evaluationStatus: 'preference',
        skillContributions: [],
        preferenceContribution: { dimension, points, maxPoints },
      });
    }

    return {
      answers,
      marksObtained: round(marksObtained),
      totalMarks: this.questions.reduce((sum, q) => sum + q.marks, 0),
      scorableMarks: round(scorableMarks),
      invalidQuestions: this.invalidQuestions,
      answeredCount: answers.filter((a) => a.evaluationStatus !== 'unanswered').length,
    };
  }

  private mcqValidity(question: ScorableQuestion): { valid: boolean; reason?: string } {
    if (question.options.length < 2) return { valid: false, reason: 'Item has fewer than two options.' };
    if (!question.correctOptionId) return { valid: false, reason: 'Item has no answer key.' };
    if (!question.options.some((o) => o.optionId === question.correctOptionId)) {
      return { valid: false, reason: 'Answer key does not match any option.' };
    }
    if (question.marks <= 0) return { valid: false, reason: 'Item carries no marks.' };
    return { valid: true };
  }

  /**
   * Distributes an item's marks across the skills it measures, honouring the
   * configured mapping weights (which are normalised to sum to 1).
   */
  private spreadMarks(
    question: ScorableQuestion,
    marksObtained: number,
    marksPossible: number,
  ): Array<{ skill: string; marksObtained: number; marksPossible: number }> {
    const mappings = question.skillMappings ?? [];
    if (mappings.length === 0) return [];
    const totalWeight = mappings.reduce((sum, m) => sum + Math.max(m.weight, 0), 0);
    if (totalWeight <= 0) return [];
    return mappings.map((mapping) => {
      const share = Math.max(mapping.weight, 0) / totalWeight;
      return {
        skill: String(mapping.skill),
        marksObtained: round(marksObtained * share),
        marksPossible: round(marksPossible * share),
      };
    });
  }
}

export interface PreferenceAggregation {
  dimension: string;
  rawPoints: number;
  maxPoints: number;
  normalisedScore: number;
  itemsAnswered: number;
}

/**
 * Aggregates personality responses into indicative working-preference scores.
 *
 * For every item the candidate could have answered `+maxPoints` or `-maxPoints`.
 * The observed range is mapped onto 0..100 where 50 means "no preference
 * expressed". These are preferences, not traits, capabilities or diagnoses.
 */
export function aggregatePreferences(
  answers: ScoredAnswer[],
): PreferenceAggregation[] {
  const byDimension = new Map<string, { raw: number; max: number; items: number }>();

  for (const answer of answers) {
    const contribution = answer.preferenceContribution;
    if (!contribution) continue;
    const entry = byDimension.get(contribution.dimension) ?? { raw: 0, max: 0, items: 0 };
    entry.raw += contribution.points;
    entry.max += contribution.maxPoints;
    entry.items += 1;
    byDimension.set(contribution.dimension, entry);
  }

  return [...byDimension.entries()].map(([dimension, entry]) => {
    // Max achievable positive score for this dimension across its items.
    const maxPositive = entry.max;
    const normalised =
      maxPositive <= 0 ? 50 : clamp(50 + (entry.raw / maxPositive) * 50, 0, 100);
    return {
      dimension,
      rawPoints: round(entry.raw),
      maxPoints: round(maxPositive),
      normalisedScore: round(normalised),
      itemsAnswered: entry.items,
    };
  });
}

export interface SkillContributionTotal {
  skill: string;
  marksObtained: number;
  marksPossible: number;
}

/** Rolls per-answer skill contributions into per-skill totals for one attempt. */
export function aggregateSkillContributions(answers: ScoredAnswer[]): SkillContributionTotal[] {
  const totals = new Map<string, { obtained: number; possible: number }>();
  for (const answer of answers) {
    if (answer.evaluationStatus === 'preference') continue;
    for (const contribution of answer.skillContributions) {
      const entry = totals.get(contribution.skill) ?? { obtained: 0, possible: 0 };
      entry.obtained += contribution.marksObtained;
      entry.possible += contribution.marksPossible;
      totals.set(contribution.skill, entry);
    }
  }
  return [...totals.entries()].map(([skill, value]) => ({
    skill,
    marksObtained: round(value.obtained),
    marksPossible: round(value.possible),
  }));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, precision = 2): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function normalisePercentage(obtained: number, possible: number): number {
  if (possible <= 0) return 0;
  return round(clamp((obtained / possible) * 100, 0, 100));
}
