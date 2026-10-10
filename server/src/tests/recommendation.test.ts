import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearDatabase,
  connectTestDatabase,
  closeTestDatabase,
  createUser,
  authed,
  loginAs,
  seedTestAssessment,
  seedTestQuestion,
  seedTestSkills,
  getApp,
} from './helpers.js';
import { afterAll, beforeAll } from 'vitest';
import {
  computeCareerMatch,
  rankMatches,
  weightedDimensionMatch,
  SCORING_WEIGHTS,
} from '../services/careers/compatibilityService.js';
import { generateCareerReport } from '../services/recommendations/recommendationService.js';
import { aiNarrativeSchema } from '../services/ai/aiProviderRegistry.js';
import { aggregatePreferences, AttemptScorer, normalisePercentage } from '../services/assessments/scoringService.js';
import { evidenceConfidence } from '../services/assessments/skillProfileService.js';
import { CandidateSkillProfileModel } from '../models/CandidateSkillProfile.js';
import { CareerModel } from '../models/Career.js';
import { CareerReportModel } from '../models/CareerReport.js';
import { RoadmapModel } from '../models/Roadmap.js';

describe('Career compatibility algorithm', () => {
  const skillId = 'skill-logical';

  const career = {
    id: 'career-1',
    slug: 'test-engineer',
    title: 'Test Engineer',
    category: 'Engineering',
    requiredSkills: [
      { skill: skillId, skillCode: 'LOGICAL_REASONING', skillName: 'Logical Reasoning', requiredLevel: 60, weight: 1, importance: 'core' as const, developmentFocus: 'Practise deduction.' },
      { skill: 'skill-sql', skillCode: 'DATABASE_CONCEPTS', skillName: 'Database Concepts', requiredLevel: 70, weight: 1, importance: 'core' as const, developmentFocus: 'Learn indexing.' },
    ],
    aptitudeFit: [{ dimension: 'logical', weight: 1 }],
    preferenceFit: [],
  };

  describe('scoring', () => {
    it('returns a perfect score when every requirement is exceeded', () => {
      const match = computeCareerMatch(career, {
        completedAssessments: 2,
        skills: [
          { skill: skillId, score: 100, evidence: 12 },
          { skill: 'skill-sql', score: 100, evidence: 12 },
        ],
        aptitudeDimensions: { logical: 100 },
        preferenceDimensions: {},
      });

      expect(match.compatibilityScore).toBe(100);
      expect(match.confidence).toBe('good');
      expect(match.dataCoverage).toBe(1);
      expect(match.gaps).toHaveLength(0);
    });

    it('returns a zero score when every measured requirement is unmet', () => {
      const match = computeCareerMatch(career, {
        completedAssessments: 2,
        skills: [
          { skill: skillId, score: 0, evidence: 12 },
          { skill: 'skill-sql', score: 0, evidence: 12 },
        ],
        aptitudeDimensions: { logical: 0 },
        preferenceDimensions: {},
      });
      expect(match.compatibilityScore).toBe(0);
      expect(match.gaps).toHaveLength(2);
    });

    it('is reproducible: identical input yields an identical score', () => {
      const profile = {
        completedAssessments: 2,
        skills: [
          { skill: skillId, score: 74, evidence: 6 },
          { skill: 'skill-sql', score: 51, evidence: 3 },
        ],
        aptitudeDimensions: { logical: 62 },
        preferenceDimensions: {},
      };
      const a = computeCareerMatch(career, profile);
      const b = computeCareerMatch(career, profile);
      expect(a.compatibilityScore).toBe(b.compatibilityScore);
      expect(a.evidence).toEqual(b.evidence);
    });

    it('damps a measurement that sits close to the requirement', () => {
      // With a measured level just above the requirement, damping lowers the
      // effective level but the ratio is already capped at 1 either way.
      const strong = computeCareerMatch(career, {
        completedAssessments: 3,
        skills: [
          { skill: skillId, score: 65, evidence: 20 },
          { skill: 'skill-sql', score: 75, evidence: 20 },
        ],
        aptitudeDimensions: { logical: 100 },
        preferenceDimensions: {},
      });
      const weak = computeCareerMatch(career, {
        completedAssessments: 1,
        skills: [
          { skill: skillId, score: 65, evidence: 1 },
          { skill: 'skill-sql', score: 75, evidence: 1 },
        ],
        aptitudeDimensions: { logical: 100 },
        preferenceDimensions: {},
      });

      expect(weak.compatibilityScore).toBeLessThan(strong.compatibilityScore);
      // A low-evidence measurement is never discarded entirely.
      expect(weak.compatibilityScore).toBeGreaterThan(0);
      const weakEvidence = weak.evidence.find((e) => e.skillCode === 'LOGICAL_REASONING');
      expect(weakEvidence!.state).toBe('measured');
      expect(weakEvidence!.measuredLevel).toBeLessThan(strong.evidence[0].measuredLevel);
      expect(weakEvidence!.measuredLevel).toBeGreaterThan(0);

      // Confidence reflects how much of the ROLE is measured, not evidence volume.
      // Both cases measure every requirement, so both are 'good' coverage.
      expect(weak.confidence).toBe('good');
      expect(weak.dataCoverage).toBe(1);
    });

    it('applies a coverage penalty when part of the role is unmeasured', () => {
      const partial = computeCareerMatch(career, {
        completedAssessments: 1,
        skills: [{ skill: skillId, score: 100, evidence: 10 }],
        aptitudeDimensions: {},
        preferenceDimensions: {},
      });

      expect(partial.dataCoverage).toBe(0.5);
      expect(partial.confidence).toBe('moderate');
      // Measured requirement contributes to the numerator, but the unmeasured one
      // still counts in the denominator and triggers the coverage damping.
      expect(partial.compatibilityScore).toBeLessThan(100);
      expect(partial.compatibilityScore).toBeGreaterThan(0);
      expect(partial.evidence.find((e) => e.skillCode === 'DATABASE_CONCEPTS')!.state).toBe('unmeasured');
    });

    it('never reports an unmeasured skill as a strength', () => {
      const match = computeCareerMatch(career, {
        completedAssessments: 1,
        skills: [{ skill: skillId, score: 100, evidence: 10 }],
        aptitudeDimensions: {},
        preferenceDimensions: {},
      });
      expect(match.strengths.map((s) => s.skillCode)).toEqual(['LOGICAL_REASONING']);
    });

    it('flags insufficient data when nothing has been measured', () => {
      const match = computeCareerMatch(career, {
        completedAssessments: 0,
        skills: [],
        aptitudeDimensions: {},
        preferenceDimensions: {},
      });
      expect(match.compatibilityScore).toBe(0);
      expect(match.insufficientData).toBe(true);
      expect(match.confidence).toBe('low');
      expect(match.deterministicSummary).toMatch(/limited evidence/i);
    });

    it('re-normalises the remaining weights when aptitude data is absent', () => {
      const withAptitude = computeCareerMatch(career, {
        completedAssessments: 2,
        skills: [
          { skill: skillId, score: 60, evidence: 8 },
          { skill: 'skill-sql', score: 70, evidence: 8 },
        ],
        aptitudeDimensions: { logical: 50 },
        preferenceDimensions: {},
      });
      const withoutAptitude = computeCareerMatch(career, {
        completedAssessments: 2,
        skills: [
          { skill: skillId, score: 60, evidence: 8 },
          { skill: 'skill-sql', score: 70, evidence: 8 },
        ],
        aptitudeDimensions: {},
        preferenceDimensions: {},
      });

      expect(withAptitude.aptitudeFitScore).toBe(50);
      // Without the aptitude component the skill fit is not diluted by it.
      expect(withoutAptitude.skillFitScore).toBeGreaterThanOrEqual(withAptitude.skillFitScore);
      expect(withoutAptitude.compatibilityScore).toBeGreaterThanOrEqual(withAptitude.compatibilityScore);
    });

    it('always produces a human-readable deterministic summary', () => {
      const match = computeCareerMatch(career, {
        completedAssessments: 1,
        skills: [{ skill: skillId, score: 20, evidence: 2 }],
        aptitudeDimensions: {},
        preferenceDimensions: {},
      });
      expect(match.deterministicSummary.length).toBeGreaterThan(40);
      expect(match.deterministicSummary).toMatch(/compatibility score/i);
    });
  });

  describe('helpers', () => {
    it('computes a weighted dimension match', () => {
      expect(weightedDimensionMatch([{ dimension: 'a', weight: 1 }, { dimension: 'b', weight: 1 }], { a: 100, b: 0 })).toBe(0.5);
      expect(weightedDimensionMatch([], { a: 100 })).toBeNull();
      expect(weightedDimensionMatch([{ dimension: 'missing', weight: 1 }], { a: 100 })).toBeNull();
    });

    it('exposes the documented weights', () => {
      expect(SCORING_WEIGHTS.skillFit + SCORING_WEIGHTS.aptitudeFit + SCORING_WEIGHTS.preferenceFit).toBeCloseTo(1, 5);
      expect(SCORING_WEIGHTS.coverageFloor).toBeGreaterThan(0);
    });

    it('ranks by score then by coverage', () => {
      const ranked = rankMatches(
        [
          { ...computeCareerMatch(career, { completedAssessments: 1, skills: [], aptitudeDimensions: {}, preferenceDimensions: {} }), careerId: 'a', compatibilityScore: 40, dataCoverage: 0.1 },
          { ...computeCareerMatch(career, { completedAssessments: 1, skills: [], aptitudeDimensions: {}, preferenceDimensions: {} }), careerId: 'b', compatibilityScore: 40, dataCoverage: 0.9 },
          { ...computeCareerMatch(career, { completedAssessments: 1, skills: [], aptitudeDimensions: {}, preferenceDimensions: {} }), careerId: 'c', compatibilityScore: 80, dataCoverage: 0.1 },
        ] as never,
        3,
      );
      expect(ranked.map((m) => m.careerId)).toEqual(['c', 'b', 'a']);
    });

    it('derives evidence confidence monotonically', () => {
      expect(evidenceConfidence(0)).toBe(0);
      expect(evidenceConfidence(10)).toBe(1);
      expect(evidenceConfidence(30)).toBe(1);
      expect(evidenceConfidence(4)).toBeGreaterThan(evidenceConfidence(2));
      expect(evidenceConfidence(2)).toBeCloseTo(0.5, 2);
    });
  });
});

describe('Personality aggregation', () => {
  it('maps neutral responses to 50 and extremes away from it', () => {
    const scorer = new AttemptScorer([
      {
        _id: 'q1',
        text: 'statement',
        questionType: 'likert',
        options: [
          { optionId: '1', text: 'Disagree', preferencePoints: -2 },
          { optionId: '2', text: 'Neutral', preferencePoints: 0 },
          { optionId: '3', text: 'Agree', preferencePoints: 2 },
        ],
        preferenceDimension: 'analytical',
        marks: 1,
        skillMappings: [],
      },
    ]);

    const agreeing = aggregatePreferences(scorer.score(new Map([['q1', '3']])).answers);
    expect(agreeing[0].normalisedScore).toBe(100);

    const disagreeing = aggregatePreferences(scorer.score(new Map([['q1', '1']])).answers);
    expect(disagreeing[0].normalisedScore).toBe(0);

    const neutral = aggregatePreferences(scorer.score(new Map([['q1', '2']])).answers);
    expect(neutral[0].normalisedScore).toBe(50);
  });

  it('never contributes personality items to the objective total', () => {
    const scorer = new AttemptScorer([
      {
        _id: 'q1',
        text: 'statement',
        questionType: 'likert',
        options: [{ optionId: '1', text: 'Agree', preferencePoints: 2 }],
        preferenceDimension: 'creative',
        marks: 1,
        skillMappings: [],
      },
    ]);
    const result = scorer.score(new Map([['q1', '1']]));
    expect(result.marksObtained).toBe(0);
    expect(result.scorableMarks).toBe(0);
    expect(result.answers[0].evaluationStatus).toBe('preference');
  });

  it('guards against a division by zero in the percentage helper', () => {
    expect(normalisePercentage(5, 0)).toBe(0);
    expect(normalisePercentage(5, 10)).toBe(50);
  });
});

describe('AI narrative validation', () => {
  const validNarrative = {
    overview: 'The candidate completed four assessments covering reasoning, technical and domain topics.',
    strengths: ['Logical reasoning is a demonstrated strength across two attempts.'],
    developmentAreas: ['Database concepts were not yet assessed in this profile.'],
    careerRationale: { 'qa-test-engineer': 'The measured testing skills line up with the requirements for this role.' },
    roadmapGuidance: { 'qa-test-engineer': ['Practise boundary-value analysis on a small module.'] },
    motivationNotes: ['Re-take the reasoning assessment in a fortnight to measure any change.'],
  };

  it('accepts a well-formed narrative', () => {
    const result = aiNarrativeSchema.safeParse(validNarrative);
    expect(result.success).toBe(true);
  });

  it('rejects a narrative that is too short to be useful', () => {
    const result = aiNarrativeSchema.safeParse({ ...validNarrative, overview: 'Great.' });
    expect(result.success).toBe(false);
  });

  it('rejects a narrative with the wrong types', () => {
    const result = aiNarrativeSchema.safeParse({ ...validNarrative, strengths: 'not an array' });
    expect(result.success).toBe(false);
  });

  it('rejects a narrative with no strengths', () => {
    const result = aiNarrativeSchema.safeParse({ ...validNarrative, strengths: [] });
    expect(result.success).toBe(false);
  });
});

describe('Report generation pipeline', () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  async function seedCandidateWithEvidence() {
    const admin = await createUser({ email: 'report-admin@example.com', role: 'admin' });
    const student = await createUser({ email: 'report-student@example.com', role: 'student' });
    const skills = await seedTestSkills();

    const q1 = await seedTestQuestion({ skillId: skills.PROGRAMMING_FUNDAMENTALS, correctOptionId: 'a' }, admin.id);
    const assessmentId = await seedTestAssessment({ questionIds: [q1], authorId: admin.id });

    await CareerModel.create({
      slug: 'software-engineer-fixture',
      title: 'Software Engineer Fixture',
      category: 'Engineering',
      description: 'Fixture career used to verify the deterministic report pipeline end to end.',
      requiredSkills: [
        {
          skill: skills.PROGRAMMING_FUNDAMENTALS,
          skillCode: 'PROGRAMMING_FUNDAMENTALS',
          skillName: 'Programming Fundamentals',
          requiredLevel: 60,
          weight: 1,
          importance: 'core',
          developmentFocus: 'Deepen fundamentals.',
        },
      ],
      aptitudeFit: [],
      preferenceFit: [],
      isActive: true,
    });

    await CareerModel.create({
      slug: 'data-analyst-fixture',
      title: 'Data Analyst Fixture',
      category: 'Analytics',
      description: 'A second fixture career so roadmap generation has more than one target to rank.',
      requiredSkills: [
        {
          skill: skills.CRITICAL_THINKING,
          skillCode: 'CRITICAL_THINKING',
          skillName: 'Critical Thinking',
          requiredLevel: 70,
          weight: 1,
          importance: 'core',
          developmentFocus: 'Practise evaluating evidence.',
        },
      ],
      aptitudeFit: [],
      preferenceFit: [],
      isActive: true,
    });

    const session = await loginAs(student.email);
    const auth = authed(session);
    const created = await auth.post('/api/v1/attempts').send({ assessmentId }).expect(201);
    await auth
      .put(`/api/v1/attempts/${created.body.data.attempt.id}/answers`)
      .send({ answers: [{ questionId: created.body.data.questions[0].id, selectedOptionId: 'a' }] })
      .expect(200);
    await auth.post(`/api/v1/attempts/${created.body.data.attempt.id}/submit`).send({ confirm: true });

    return { admin, student, skills, auth, session };
  }

  it('produces a complete report without any AI provider configured', async () => {
    const { student, admin } = await seedCandidateWithEvidence();

    const result = await generateCareerReport({
      candidateId: student.id,
      generatedBy: admin.id,
      includeRoadmaps: true,
      roadmapCount: 2,
      narrativeGenerator: async () => ({
        narrative: null,
        provider: 'none',
        failureReason: 'No AI provider is configured.',
      }),
    });

    expect(result.aiProviderUsed).toBe('none');
    expect(result.aiAvailable).toBe(false);
    expect(result.aiFailureReason).toBeTruthy();
    expect(result.recommendations.length).toBeGreaterThan(0);

    const report = await CareerReportModel.findOne({ candidate: student.id });
    expect(report).not.toBeNull();
    expect(report!.generationStatus).toBe('completed');
    expect(report!.scoringVersion).toBe('compatibility-v1.0.0');
    expect(report!.aiProviderUsed).toBe('none');
    expect(report!.aiNarrative).toBeUndefined();
    // The deterministic explanation is always present.
    expect(report!.recommendations[0].deterministicSummary.length).toBeGreaterThan(20);
    expect(report!.disclaimer).toMatch(/not a probability/i);
    expect(report!.inputAttemptIds).toHaveLength(1);

    expect(await RoadmapModel.countDocuments({ candidate: student.id })).toBe(2);
  });

  it('attaches an AI explanation when the provider returns valid output', async () => {
    const { student, admin } = await seedCandidateWithEvidence();

    await generateCareerReport({
      candidateId: student.id,
      generatedBy: admin.id,
      includeRoadmaps: false,
      narrativeGenerator: async (input) => {
        const slug = input.careers[0].slug;
        return {
          narrative: {
            overview: 'The candidate has completed assessments covering reasoning and technical topics.',
            strengths: ['Programming fundamentals were demonstrated in the most recent attempt.'],
            developmentAreas: ['Additional domain assessments would raise the confidence of this report.'],
            careerRationale: { [slug]: 'The measured skills line up with the requirements listed for this role.' },
            roadmapGuidance: { [slug]: ['Complete one small project using the measured competency.'] },
            motivationNotes: ['Re-assess in a fortnight to measure any change.'],
          },
          provider: 'gemini',
          latencyMs: 1200,
        };
      },
    });

    const report = await CareerReportModel.findOne({ candidate: student.id });
    expect(report!.aiProviderUsed).toBe('gemini');
    expect(report!.aiNarrative).toBeTruthy();
    expect(report!.aiLatencyMs).toBe(1200);
    expect(report!.recommendations[0].aiExplanation).toBeTruthy();
  });

  it('falls back safely when the provider returns an unsupported career reference', async () => {
    const { student, admin } = await seedCandidateWithEvidence();

    await generateCareerReport({
      candidateId: student.id,
      generatedBy: admin.id,
      includeRoadmaps: false,
      narrativeGenerator: async () => ({
        narrative: {
          overview: 'A summary that is definitely long enough to satisfy the schema requirements.',
          strengths: ['Something demonstrated.'],
          developmentAreas: ['Something to develop.'],
          // Slugs the model made up - the pipeline must discard these keys.
          careerRationale: { 'made-up-career-key': 'Should be removed.' },
          roadmapGuidance: { 'another-fabricated-key': ['Nope.'] },
          motivationNotes: [],
        },
        provider: 'gemini',
      }),
    });

    const report = await CareerReportModel.findOne({ candidate: student.id });
    const slugs = report!.recommendations.map((r) => r.careerSlug);
    expect(slugs).not.toContain('made-up-career-key');

    // Because no reference survived the allow-list, the narrative is discarded
    // entirely and the provider output is not persisted at all.
    expect(report!.aiNarrative).toBeUndefined();
    expect(report!.aiFailureReason).toMatch(/no known career/i);
    expect(report!.recommendations[0].aiExplanation).toBeUndefined();
    // Scoring is unaffected by the model's output.
    expect(report!.recommendations[0].compatibilityScore).toBeGreaterThan(0);
    expect(report!.recommendations[0].deterministicSummary).toBeTruthy();
  });

  it('falls back safely when the provider throws', async () => {
    const { student, admin } = await seedCandidateWithEvidence();

    const result = await generateCareerReport({
      candidateId: student.id,
      generatedBy: admin.id,
      includeRoadmaps: false,
      narrativeGenerator: async () => {
        throw new Error('Provider timed out');
      },
    });

    expect(result.aiAvailable).toBe(false);
    const report = await CareerReportModel.findOne({ candidate: student.id });
    expect(report!.generationStatus).toBe('completed');
    expect(report!.recommendations[0].deterministicSummary).toBeTruthy();
  });

  it('reuses an up-to-date report instead of recomputing it', async () => {
    const { student, admin } = await seedCandidateWithEvidence();

    const first = await generateCareerReport({ candidateId: student.id, generatedBy: admin.id, includeRoadmaps: false });
    const second = await generateCareerReport({ candidateId: student.id, generatedBy: admin.id, includeRoadmaps: false });

    expect(second.reused).toBe(true);
    expect(second.reportId).toBe(first.reportId);
    expect(await CareerReportModel.countDocuments({ candidate: student.id })).toBe(1);

    const forced = await generateCareerReport({
      candidateId: student.id,
      generatedBy: admin.id,
      includeRoadmaps: false,
      forceRegenerate: true,
    });
    expect(forced.reused).toBe(false);
    expect(await CareerReportModel.countDocuments({ candidate: student.id })).toBe(2);
  });

  it('produces a report even with no assessment evidence', async () => {
    const admin = await createUser({ email: 'empty-admin@example.com', role: 'admin' });
    const student = await createUser({ email: 'empty-student@example.com', role: 'student' });
    await CareerModel.create({
      slug: 'empty-fixture',
      title: 'Empty Fixture Career',
      category: 'Engineering',
      description: 'A fixture career with requirements but no candidate evidence yet.',
      requiredSkills: [],
      aptitudeFit: [],
      preferenceFit: [],
      isActive: true,
    });

    const result = await generateCareerReport({
      candidateId: student.id,
      generatedBy: admin.id,
      includeRoadmaps: false,
    });

    expect(result.completedAssessments).toBe(0);
    const report = await CareerReportModel.findOne({ candidate: student.id });
    expect(report).not.toBeNull();
    expect(report!.completedAssessments).toBe(0);
  });

  it('refuses to generate a report when the career catalogue is empty', async () => {
    const admin = await createUser({ email: 'nocareer-admin@example.com', role: 'admin' });
    const student = await createUser({ email: 'nocareer-student@example.com', role: 'student' });
    await expect(
      generateCareerReport({ candidateId: student.id, generatedBy: admin.id, includeRoadmaps: false }),
    ).rejects.toThrow(/catalogue is empty/i);
  });

  it('exposes report authorisation over HTTP', async () => {
    const { student, auth } = await seedCandidateWithEvidence();
    const other = await createUser({ email: 'report-other@example.com', role: 'student' });

    const generated = await auth
      .post('/api/v1/reports/generate')
      .send({ includeRoadmaps: false, roadmapCount: 0 })
      .expect(200);
    const reportNumber = generated.body.data.reportId;

    await auth.get(`/api/v1/reports/${reportNumber}`).expect(200);

    const otherAuth = authed(await loginAs(other.email));
    await otherAuth.get(`/api/v1/reports/${reportNumber}`).expect(403);
    await otherAuth.get(`/api/v1/reports/${reportNumber}/download`).expect(403);
    await otherAuth
      .post('/api/v1/reports/generate')
      .send({ candidateId: student.id, includeRoadmaps: false })
      .expect(403);
  });

  it('exposes the skill profile and compatibility preview over HTTP', async () => {
    const { student, auth } = await seedCandidateWithEvidence();

    const profile = await auth.get('/api/v1/profile/skill-profile').expect(200);
    expect(profile.body.data.empty).toBe(false);
    expect(profile.body.data.measurements[0].code).toBe('PROGRAMMING_FUNDAMENTALS');

    const preview = await auth.get('/api/v1/compatibility').expect(200);
    expect(preview.body.data.scoringVersion).toBe('compatibility-v1.0.0');
    expect(preview.body.data.matches.length).toBeGreaterThan(0);
    expect(preview.body.data.matches[0].evidence.length).toBeGreaterThan(0);
  });

  it('reports an empty state rather than fabricated numbers when nothing is measured', async () => {
    const student = await createUser({ email: 'empty-profile@example.com', role: 'student' });
    const auth = authed(await loginAs(student.email));

    const profile = await auth.get('/api/v1/profile/skill-profile').expect(200);
    expect(profile.body.data.empty).toBe(true);
    expect(profile.body.data.measurements).toEqual([]);

    const dashboard = await auth.get('/api/v1/analytics/self').expect(200);
    expect(dashboard.body.data.isEmpty).toBe(true);
    expect(dashboard.body.data.summary.averageObjectiveScore).toBeNull();
    expect(dashboard.body.data.summary.skillsMeasured).toBe(0);

    const progression = await auth.get('/api/v1/analytics/progression').expect(200);
    expect(progression.body.data.empty).toBe(true);
  });

  it('starts roadmaps at zero progress and never marks them complete', async () => {
    const { student, admin, auth } = await seedCandidateWithEvidence();

    await auth.post('/api/v1/reports/generate').send({ includeRoadmaps: true, roadmapCount: 1 }).expect(200);

    const { RoadmapModel: Roadmaps } = { RoadmapModel };
    const roadmap = await Roadmaps.findOne({ candidate: student.id });
    expect(roadmap).not.toBeNull();
    expect(roadmap!.progressPercent).toBe(0);
    expect(roadmap!.items.every((i) => i.status === 'not_started')).toBe(true);
    expect(roadmap!.milestones.every((m) => m.completed === false)).toBe(true);
    void admin;
  });

  it('updates roadmap progress only when the candidate acts', async () => {
    const { student, auth } = await seedCandidateWithEvidence();
    await auth.post('/api/v1/reports/generate').send({ includeRoadmaps: true, roadmapCount: 1 }).expect(200);

    const list = await auth.get('/api/v1/roadmaps').expect(200);
    const roadmap = list.body.data.roadmaps[0];
    const item = roadmap.items[0];

    const updated = await auth
      .patch(`/api/v1/roadmaps/${roadmap.id}/items/${item.id}`)
      .send({ status: 'completed' })
      .expect(200);

    expect(updated.body.data.roadmap.progressPercent).toBeGreaterThan(0);
    const completed = updated.body.data.roadmap.items.find((i: { id: string }) => i.id === item.id);
    expect(completed.status).toBe('completed');
    expect(completed.completedAt).not.toBeNull();
    expect(roadmap.id).toBeTruthy();
  });

  it('prevents a candidate from changing another candidate\'s roadmap', async () => {
    const { student, auth } = await seedCandidateWithEvidence();
    await auth.post('/api/v1/reports/generate').send({ includeRoadmaps: true, roadmapCount: 1 }).expect(200);
    const list = await auth.get('/api/v1/roadmaps').expect(200);
    const roadmap = list.body.data.roadmaps[0];

    const other = await createUser({ email: 'roadmap-other@example.com', role: 'student' });
    const otherAuth = authed(await loginAs(other.email));
    await otherAuth
      .patch(`/api/v1/roadmaps/${roadmap.id}/items/${roadmap.items[0].id}`)
      .send({ status: 'completed' })
      .expect(403);
    expect(String(roadmap.candidateId)).toBe(student.id);
  });

  it('returns a printable HTML report', async () => {
    const { auth, session } = await seedCandidateWithEvidence();
    const generated = await auth.post('/api/v1/reports/generate').send({ includeRoadmaps: false }).expect(200);
    const reportNumber = generated.body.data.reportId;

    const response = await session.agent.get(`/api/v1/reports/${reportNumber}/download`).expect(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('<!doctype html>');
    expect(response.text).toContain('Career compatibility score');
    expect(response.text).toContain('Important limitations');
  });

  it('exports analytics as CSV for permitted roles only', async () => {
    const { session } = await seedCandidateWithEvidence();
    const response = await session.agent.get('/api/v1/exports/analytics.csv');
    expect(response.status).toBe(403);

    const admin = await createUser({ email: 'csv-admin@example.com', role: 'admin' });
    const adminSession = await loginAs(admin.email);
    const ok = await adminSession.agent.get('/api/v1/exports/analytics.csv').expect(200);
    expect(ok.headers['content-type']).toContain('text/csv');
    expect(ok.text).toContain('total_users');
  });
});

void getApp;
void CandidateSkillProfileModel;
