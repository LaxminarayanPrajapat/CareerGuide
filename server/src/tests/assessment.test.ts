import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import {
  clearDatabase,
  closeTestDatabase,
  connectTestDatabase,
  createUser,
  getApp,
  loginAs,
  authed,
  seedTestAssessment,
  seedTestCareer,
  seedTestPreferenceQuestion,
  seedTestQuestion,
  seedTestSkills,
} from './helpers.js';
import { AttemptModel } from '../models/Attempt.js';
import { AnswerModel } from '../models/Answer.js';
import { CandidateSkillProfileModel, SkillProfileRevisionModel } from '../models/CandidateSkillProfile.js';
import { finaliseAttempt, sweepExpiredAttempts } from '../services/assessments/attemptService.js';

describe('Assessment workflow', () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  async function setup(options: { questionCount?: number; durationMinutes?: number; category?: string } = {}) {
    const admin = await createUser({ email: 'teacher@example.com', role: 'admin' });
    const student = await createUser({ email: 'learner@example.com', role: 'student' });
    const skills = await seedTestSkills();

    const questionIds: string[] = [];
    const count = options.questionCount ?? 4;
    for (let i = 0; i < count; i += 1) {
      questionIds.push(
        await seedTestQuestion(
          { skillId: skills.PROGRAMMING_FUNDAMENTALS, correctOptionId: 'a', category: options.category },
          admin.id,
        ),
      );
    }

    const assessmentId = await seedTestAssessment({
      questionIds,
      authorId: admin.id,
      durationMinutes: options.durationMinutes ?? 30,
      category: options.category,
    });

    const studentAuth = authed(await loginAs(student.email));
    return { admin, student, skills, questionIds, assessmentId, studentAuth };
  }

  describe('discovery', () => {
    it('lists only published, available test sets for a candidate', async () => {
      const admin = await createUser({ email: 'pub-admin@example.com', role: 'admin' });
      const student = await createUser({ email: 'pub-student@example.com', role: 'student' });
      const skills = await seedTestSkills();
      const q1 = await seedTestQuestion({ skillId: skills.PROGRAMMING_FUNDAMENTALS }, admin.id);

      await seedTestAssessment({ questionIds: [q1], authorId: admin.id, status: 'published', title: 'Published test' });
      await seedTestAssessment({ questionIds: [q1], authorId: admin.id, status: 'draft', title: 'Draft test' });

      const auth = authed(await loginAs(student.email));
      const response = await auth.get('/api/v1/attempts/available').expect(200);
      const titles = response.body.data.assessments.map((a: { title: string }) => a.title);

      expect(titles).toContain('Published test');
      expect(titles).not.toContain('Draft test');
    });

    it('refuses to start an unpublished assessment', async () => {
      const admin = await createUser({ email: 'draft-admin@example.com', role: 'admin' });
      const student = await createUser({ email: 'draft-student@example.com', role: 'student' });
      const skills = await seedTestSkills();
      const q1 = await seedTestQuestion({ skillId: skills.PROGRAMMING_FUNDAMENTALS }, admin.id);
      const assessmentId = await seedTestAssessment({ questionIds: [q1], authorId: admin.id, status: 'draft' });

      const auth = authed(await loginAs(student.email));
      await auth.post('/api/v1/attempts').send({ assessmentId }).expect(403);
    });
  });

  describe('attempt lifecycle', () => {
    it('creates a persistent attempt with a server-recorded deadline', async () => {
      const { assessmentId, student, studentAuth } = await setup({ durationMinutes: 15 });

      const before = Date.now();
      const response = await studentAuth.post('/api/v1/attempts').send({ assessmentId }).expect(201);
      const after = Date.now();

      const payload = response.body.data;
      expect(payload.questions.length).toBe(4);
      expect(payload.attempt.status).toBe('in_progress');

      const expiresAt = new Date(payload.attempt.expiresAt).getTime();
      const expectedStart = before + 15 * 60 * 1000;
      // Allow a generous window for request latency and clock granularity.
      expect(expiresAt).toBeGreaterThanOrEqual(expectedStart - 5000);
      expect(expiresAt).toBeLessThanOrEqual(after + 15 * 60 * 1000 + 5000);
      expect(payload.attempt.secondsRemaining).toBeGreaterThan(14 * 60);
      expect(payload.attempt.secondsRemaining).toBeLessThanOrEqual(15 * 60);

      const attempt = await AttemptModel.findById(payload.attempt.id);
      expect(String(attempt!.candidate)).toBe(student.id);
      expect(attempt!.questionOrder).toHaveLength(4);
    });

    it('never exposes the answer key to the candidate', async () => {
      const { assessmentId, studentAuth } = await setup();
      const response = await studentAuth.post('/api/v1/attempts').send({ assessmentId }).expect(201);
      const serialised = JSON.stringify(response.body);
      expect(serialised).not.toContain('correctOptionId');
      expect(serialised).not.toContain('explanation');
      expect(serialised).not.toContain('skillMappings');
    });

    it('returns the same attempt on refresh, preserving the remaining time', async () => {
      const { assessmentId, studentAuth } = await setup({ durationMinutes: 20 });

      const created = await studentAuth.post('/api/v1/attempts').send({ assessmentId }).expect(201);
      const attemptId = created.body.data.attempt.id;

      await new Promise((resolve) => setTimeout(resolve, 1200));

      const reloaded = await studentAuth.get(`/api/v1/attempts/${attemptId}`).expect(200);
      expect(reloaded.body.data.attempt.id).toBe(attemptId);
      expect(reloaded.body.data.attempt.expiresAt).toBe(created.body.data.attempt.expiresAt);

      const original = created.body.data.attempt.secondsRemaining;
      const now = reloaded.body.data.attempt.secondsRemaining;
      expect(now).toBeLessThanOrEqual(original);
      expect(now).toBeGreaterThan(original - 10);

      // Only one attempt row exists despite the refresh.
      expect(await AttemptModel.countDocuments({ candidate: created.body.data.attempt.id })).toBeLessThanOrEqual(1);
      expect(await AttemptModel.countDocuments({ status: 'in_progress' })).toBe(1);
    });

    it('rejects a question that is not part of the attempt', async () => {
      const { assessmentId, studentAuth, admin, skills } = await setup();
      const created = await studentAuth.post('/api/v1/attempts').send({ assessmentId }).expect(201);

      const foreign = await seedTestQuestion({ skillId: skills.LOGICAL_REASONING }, admin.id);
      await studentAuth
        .put(`/api/v1/attempts/${created.body.data.attempt.id}/answers`)
        .send({ answers: [{ questionId: foreign, selectedOptionId: 'a' }] })
        .expect(400);
    });

    it('counts answered questions from the server, not from the client', async () => {
      const { assessmentId, studentAuth } = await setup();
      const created = await studentAuth.post('/api/v1/attempts').send({ assessmentId }).expect(201);
      const { attempt, questions } = created.body.data;

      const saved = await studentAuth
        .put(`/api/v1/attempts/${attempt.id}/answers`)
        .send({
          answers: questions.slice(0, 3).map((q: { id: string }) => ({ questionId: q.id, selectedOptionId: 'b' })),
        })
        .expect(200);

      expect(saved.body.data.answeredCount).toBe(3);

      // Re-reading the attempt reflects the stored state.
      const reloaded = await studentAuth.get(`/api/v1/attempts/${attempt.id}`).expect(200);
      expect(reloaded.body.data.attempt.answeredCount).toBe(3);
      expect(reloaded.body.data.savedAnswers.filter((a: { selectedOptionId?: string }) => a.selectedOptionId)).toHaveLength(3);
    });
  });

  describe('scoring', () => {
    it('awards marks from the stored answer key', async () => {
      const { assessmentId, studentAuth } = await setup({ questionCount: 4 });
      const created = await studentAuth.post('/api/v1/attempts').send({ assessmentId }).expect(201);
      const { attempt, questions } = created.body.data;

      await studentAuth
        .put(`/api/v1/attempts/${attempt.id}/answers`)
        .send({
          answers: questions.map((q: { id: string }) => ({ questionId: q.id, selectedOptionId: 'a' })),
        })
        .expect(200);

      const submitted = await studentAuth.post(`/api/v1/attempts/${attempt.id}/submit`).send({ confirm: true }).expect(200);
      const result = submitted.body.data;

      expect(result.scoringModel).toBe('objective');
      expect(result.marksObtained).toBe(4);
      expect(result.totalMarks).toBe(4);
      expect(result.percentage).toBe(100);
      expect(result.passed).toBe(true);
      expect(result.skillResults[0].skillCode).toBe('PROGRAMMING_FUNDAMENTALS');
    });

    it('counts unanswered items as zero without removing them from the total', async () => {
      const { assessmentId, studentAuth } = await setup({ questionCount: 4 });
      const created = await studentAuth.post('/api/v1/attempts').send({ assessmentId }).expect(201);
      const { attempt, questions } = created.body.data;

      await studentAuth
        .put(`/api/v1/attempts/${attempt.id}/answers`)
        .send({ answers: [{ questionId: questions[0].id, selectedOptionId: 'a' }] })
        .expect(200);

      const result = (await studentAuth.post(`/api/v1/attempts/${attempt.id}/submit`).send({ confirm: true }).expect(200))
        .body.data;

      expect(result.marksObtained).toBe(1);
      expect(result.totalMarks).toBe(4);
      expect(result.percentage).toBe(25);
      expect(result.passed).toBe(false);
    });

    it('scores personality items as preferences, never as right or wrong', async () => {
      const admin = await createUser({ email: 'pref-admin@example.com', role: 'admin' });
      const student = await createUser({ email: 'pref-student@example.com', role: 'student' });
      const skills = await seedTestSkills();

      const q1 = await seedTestPreferenceQuestion('analytical', skills.CRITICAL_THINKING, admin.id);
      const q2 = await seedTestPreferenceQuestion('creative', skills.CRITICAL_THINKING, admin.id);
      const assessmentId = await seedTestAssessment({
        questionIds: [q1, q2],
        authorId: admin.id,
        category: 'personality',
      });

      const auth = authed(await loginAs(student.email));
      const created = await auth.post('/api/v1/attempts').send({ assessmentId }).expect(201);
      const { attempt, questions } = created.body.data;

      await auth
        .put(`/api/v1/attempts/${attempt.id}/answers`)
        .send({
          answers: [
            { questionId: questions[0].id, selectedOptionId: '3' },
            { questionId: questions[1].id, selectedOptionId: '1' },
          ],
        })
        .expect(200);

      const result = (await auth.post(`/api/v1/attempts/${attempt.id}/submit`).send({ confirm: true }).expect(200))
        .body.data;

      expect(result.scoringModel).toBe('preference');
      expect(result.percentage).toBeNull();
      expect(result.marksObtained).toBeNull();
      expect(result.passed).toBeNull();
      expect(result.preferenceResults).toHaveLength(2);

      const analytical = result.preferenceResults.find((p: { dimension: string }) => p.dimension === 'analytical');
      const creative = result.preferenceResults.find((p: { dimension: string }) => p.dimension === 'creative');
      expect(analytical.normalisedScore).toBeGreaterThan(creative.normalisedScore);
      expect(analytical.normalisedScore).toBeGreaterThan(50);
    });

    it('excludes a malformed item instead of inventing an answer key', async () => {
      const admin = await createUser({ email: 'badkey-admin@example.com', role: 'admin' });
      const student = await createUser({ email: 'badkey-student@example.com', role: 'student' });
      const skills = await seedTestSkills();

      const good = await seedTestQuestion({ skillId: skills.PROGRAMMING_FUNDAMENTALS, correctOptionId: 'a' }, admin.id);
      // Same skill, but the answer key is removed after creation.
      const bad = await seedTestQuestion({ skillId: skills.PROGRAMMING_FUNDAMENTALS, correctOptionId: 'a' }, admin.id);
      const { QuestionModel } = await import('../models/Question.js');
      await QuestionModel.updateOne({ _id: bad }, { $unset: { correctOptionId: 1 } });

      const assessmentId = await seedTestAssessment({ questionIds: [good, bad], authorId: admin.id });

      const auth = authed(await loginAs(student.email));
      const created = await auth.post('/api/v1/attempts').send({ assessmentId }).expect(201);
      const { attempt, questions } = created.body.data;

      await auth
        .put(`/api/v1/attempts/${attempt.id}/answers`)
        .send({ answers: questions.map((q: { id: string }) => ({ questionId: q.id, selectedOptionId: 'a' })) })
        .expect(200);

      const result = (await auth.post(`/api/v1/attempts/${attempt.id}/submit`).send({ confirm: true }).expect(200))
        .body.data;

      expect(result.invalidItemCount).toBe(1);
      expect(result.marksObtained).toBe(1);
      // The malformed item is excluded from the denominator rather than counted
      // as wrong, and the reduced denominator is reported explicitly.
      expect(result.totalMarks).toBe(2);
      expect(result.scorableMarks).toBe(1);
      expect(result.percentage).toBe(100);

      const invalid = result.review.find((r: { evaluationStatus: string }) => r.evaluationStatus === 'invalid');
      expect(invalid.invalidReason).toMatch(/answer key/i);
      expect(invalid.correctOptionId).toBeNull();
    });

    it('flags a response that does not correspond to any option', async () => {
      const { assessmentId, studentAuth } = await setup({ questionCount: 2 });
      const created = await studentAuth.post('/api/v1/attempts').send({ assessmentId }).expect(201);
      const { attempt, questions } = created.body.data;

      await studentAuth
        .put(`/api/v1/attempts/${attempt.id}/answers`)
        .send({ answers: [{ questionId: questions[0].id, selectedOptionId: 'zzz' }] })
        .expect(200);

      const result = (await studentAuth.post(`/api/v1/attempts/${attempt.id}/submit`).send({ confirm: true }).expect(200))
        .body.data;

      const flagged = result.review.find((r: { evaluationStatus: string }) => r.evaluationStatus === 'invalid');
      expect(flagged.invalidReason).toMatch(/not part of this item/i);
    });
  });

  describe('submission rules', () => {
    it('prevents a second submission from rescoring the attempt', async () => {
      const { assessmentId, studentAuth } = await setup({ questionCount: 2 });
      const created = await studentAuth.post('/api/v1/attempts').send({ assessmentId }).expect(201);
      const { attempt, questions } = created.body.data;

      await studentAuth
        .put(`/api/v1/attempts/${attempt.id}/answers`)
        .send({ answers: questions.map((q: { id: string }) => ({ questionId: q.id, selectedOptionId: 'a' })) })
        .expect(200);

      const first = await studentAuth.post(`/api/v1/attempts/${attempt.id}/submit`).send({ confirm: true }).expect(200);
      expect(first.body.data.marksObtained).toBe(2);

      // Change the stored answers directly, then try to resubmit.
      await AnswerModel.updateMany({ attempt: attempt.id }, { $set: { selectedOptionId: 'b' } });

      const second = await studentAuth.post(`/api/v1/attempts/${attempt.id}/submit`).send({ confirm: true }).expect(200);
      expect(second.body.message).toMatch(/already submitted/i);
      expect(second.body.data.marksObtained).toBe(2);
      expect(second.body.data.status).toBe('submitted');
    });

    it('rejects answer changes after submission with 409', async () => {
      const { assessmentId, studentAuth } = await setup();
      const created = await studentAuth.post('/api/v1/attempts').send({ assessmentId }).expect(201);
      const { attempt, questions } = created.body.data;

      await studentAuth.post(`/api/v1/attempts/${attempt.id}/submit`).send({ confirm: true }).expect(200);
      await studentAuth
        .put(`/api/v1/attempts/${attempt.id}/answers`)
        .send({ answers: [{ questionId: questions[0].id, selectedOptionId: 'c' }] })
        .expect(409);
    });

    it('auto-submits an attempt once the server deadline has passed', async () => {
      const { assessmentId, student, studentAuth } = await setup({ questionCount: 2 });
      const created = await studentAuth.post('/api/v1/attempts').send({ assessmentId }).expect(201);
      const { attempt, questions } = created.body.data;

      await studentAuth
        .put(`/api/v1/attempts/${attempt.id}/answers`)
        .send({ answers: [{ questionId: questions[0].id, selectedOptionId: 'a' }] })
        .expect(200);

      // Move the stored deadline into the past.
      await AttemptModel.updateOne({ _id: attempt.id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });

      const response = await studentAuth
        .put(`/api/v1/attempts/${attempt.id}/answers`)
        .send({ answers: [{ questionId: questions[1].id, selectedOptionId: 'b' }] });
      expect(response.status).toBe(410);

      const stored = await AttemptModel.findById(attempt.id);
      expect(stored!.status).toBe('auto_submitted');
      expect(stored!.submissionReason).toBe('time_expired');
      expect(stored!.marksObtained).toBe(1);

      const result = await studentAuth.get(`/api/v1/attempts/${attempt.id}/result`).expect(200);
      expect(result.body.data.submissionReason).toBe('time_expired');
      expect(String(result.body.data.id)).toBe(attempt.id);
      expect(String((await AttemptModel.findById(attempt.id))!.candidate)).toBe(student.id);
    });

    it('sweeps expired attempts even if the client never submits', async () => {
      const { assessmentId } = await setup({ questionCount: 2 });
      const { StudentSession } = { StudentSession: null };
      void StudentSession;

      const student = await createUser({ email: 'sweep@example.com', role: 'student' });
      const auth = authed(await loginAs(student.email));
      const created = await auth.post('/api/v1/attempts').send({ assessmentId }).expect(201);
      await AttemptModel.updateOne(
        { _id: created.body.data.attempt.id },
        { $set: { expiresAt: new Date(Date.now() - 60_000) } },
      );

      const processed = await sweepExpiredAttempts();
      expect(processed).toBe(1);

      const stored = await AttemptModel.findById(created.body.data.attempt.id);
      expect(stored!.status).toBe('auto_submitted');
    });

    it('enforces the attempt limit', async () => {
      const admin = await createUser({ email: 'limit-admin@example.com', role: 'admin' });
      const student = await createUser({ email: 'limit-student@example.com', role: 'student' });
      const skills = await seedTestSkills();
      const q1 = await seedTestQuestion({ skillId: skills.PROGRAMMING_FUNDAMENTALS }, admin.id);
      const assessmentId = await seedTestAssessment({ questionIds: [q1], authorId: admin.id, maxAttempts: 1 });

      const auth = authed(await loginAs(student.email));
      const created = await auth.post('/api/v1/attempts').send({ assessmentId }).expect(201);
      await auth.post(`/api/v1/attempts/${created.body.data.attempt.id}/submit`).send({ confirm: true }).expect(200);

      const blocked = await auth.post('/api/v1/attempts').send({ assessmentId }).expect(403);
      expect(blocked.body.message).toMatch(/attempt/i);
    });

    it('finaliseAttempt is idempotent when called twice directly', async () => {
      const { assessmentId } = await setup({ questionCount: 2 });
      const student = await createUser({ email: 'idem@example.com', role: 'student' });
      const auth = authed(await loginAs(student.email));
      const created = await auth.post('/api/v1/attempts').send({ assessmentId }).expect(201);
      const attemptId = created.body.data.attempt.id;

      const first = await finaliseAttempt({ attemptId, reason: 'manual' });
      expect(first.alreadyFinalised).toBe(false);

      const second = await finaliseAttempt({ attemptId, reason: 'manual' });
      expect(second.alreadyFinalised).toBe(true);
    });
  });

  describe('ownership', () => {
    it('prevents one candidate reading another candidate\'s attempt', async () => {
      const { assessmentId, student } = await setup();
      const other = await createUser({ email: 'nosy@example.com', role: 'student' });

      const ownerAuth = authed(await loginAs(student.email));
      const created = await ownerAuth.post('/api/v1/attempts').send({ assessmentId }).expect(201);

      const otherAuth = authed(await loginAs(other.email));
      await otherAuth.get(`/api/v1/attempts/${created.body.data.attempt.id}`).expect(404);
      await otherAuth.get(`/api/v1/attempts/${created.body.data.attempt.id}/result`).expect(404);
      await otherAuth
        .post(`/api/v1/attempts/${created.body.data.attempt.id}/submit`)
        .send({ confirm: true })
        .expect(404);
    });
  });

  describe('skill profile updates', () => {
    it('creates a skill profile from a completed attempt', async () => {
      const { assessmentId, student, studentAuth } = await setup({ questionCount: 4 });
      const created = await studentAuth.post('/api/v1/attempts').send({ assessmentId }).expect(201);
      const { attempt, questions } = created.body.data;

      await studentAuth
        .put(`/api/v1/attempts/${attempt.id}/answers`)
        .send({
          answers: questions.map((q: { id: string }, i: number) => ({
            questionId: q.id,
            // 3 correct, 1 wrong -> 75%
            selectedOptionId: i < 3 ? 'a' : 'b',
          })),
        })
        .expect(200);

      await studentAuth.post(`/api/v1/attempts/${attempt.id}/submit`).send({ confirm: true }).expect(200);

      const profile = await CandidateSkillProfileModel.findOne({ candidate: student.id });
      expect(profile).not.toBeNull();
      expect(profile!.measurements).toHaveLength(1);
      expect(profile!.measurements[0].skillCode).toBe('PROGRAMMING_FUNDAMENTALS');
      expect(profile!.measurements[0].score).toBe(75);
      expect(profile!.totalCompletedAssessments).toBe(1);
      expect(profile!.revision).toBe(2);

      const revisions = await SkillProfileRevisionModel.find({ candidate: student.id });
      expect(revisions.length).toBeGreaterThanOrEqual(1);
    });

    it('keeps history and moves the level towards the new observation', async () => {
      const { assessmentId, student, studentAuth } = await setup({ questionCount: 4 });

      // First attempt: all correct -> 100
      const first = await studentAuth.post('/api/v1/attempts').send({ assessmentId }).expect(201);
      await studentAuth
        .put(`/api/v1/attempts/${first.body.data.attempt.id}/answers`)
        .send({
          answers: first.body.data.questions.map((q: { id: string }) => ({
            questionId: q.id,
            selectedOptionId: 'a',
          })),
        })
        .expect(200);
      await studentAuth.post(`/api/v1/attempts/${first.body.data.attempt.id}/submit`).send({ confirm: true });

      // Second attempt: all wrong -> 0
      const second = await studentAuth.post('/api/v1/attempts').send({ assessmentId }).expect(201);
      await studentAuth
        .put(`/api/v1/attempts/${second.body.data.attempt.id}/answers`)
        .send({
          answers: second.body.data.questions.map((q: { id: string }) => ({
            questionId: q.id,
            selectedOptionId: 'c',
          })),
        })
        .expect(200);
      await studentAuth.post(`/api/v1/attempts/${second.body.data.attempt.id}/submit`).send({ confirm: true });

      const profile = await CandidateSkillProfileModel.findOne({ candidate: student.id });
      const measurement = profile!.measurements[0];

      // Evidence-weighted mean of 100 and 0 with equal evidence: 50.
      expect(measurement.score).toBe(50);
      expect(measurement.observations).toBe(2);
      expect(measurement.evidence).toBe(8);
      expect(measurement.history).toHaveLength(2);

      // Both attempts remain queryable - history is never overwritten.
      expect(await AttemptModel.countDocuments({ candidate: student.id })).toBe(2);
    });

    it('does not create a profile revision for an attempt that was never submitted', async () => {
      const { assessmentId, student, studentAuth } = await setup({ questionCount: 2 });
      await studentAuth.post('/api/v1/attempts').send({ assessmentId }).expect(201);
      expect(await CandidateSkillProfileModel.countDocuments({ candidate: student.id })).toBe(0);
    });
  });

  describe('history', () => {
    it('lists completed attempts newest first and excludes live ones', async () => {
      const { assessmentId, studentAuth } = await setup({ questionCount: 2 });

      // Complete the first attempt, then start a second one that is left live.
      const first = await studentAuth.post('/api/v1/attempts').send({ assessmentId }).expect(201);
      await studentAuth.post(`/api/v1/attempts/${first.body.data.attempt.id}/submit`).send({ confirm: true });
      const live = await studentAuth.post('/api/v1/attempts').send({ assessmentId }).expect(201);

      expect(live.body.data.attempt.id).not.toBe(first.body.data.attempt.id);

      const history = await studentAuth.get('/api/v1/attempts/history').expect(200);
      expect(history.body.data.attempts).toHaveLength(1);
      expect(history.body.data.attempts[0].id).toBe(first.body.data.attempt.id);
      expect(history.body.data.attempts[0].id).not.toBe(live.body.data.attempt.id);
      expect(history.body.meta.total).toBe(1);
    });

    it('reuses the live attempt instead of creating a second one', async () => {
      const { assessmentId, studentAuth } = await setup({ questionCount: 2 });

      const first = await studentAuth.post('/api/v1/attempts').send({ assessmentId }).expect(201);
      const second = await studentAuth.post('/api/v1/attempts').send({ assessmentId }).expect(201);

      expect(second.body.data.attempt.id).toBe(first.body.data.attempt.id);
      expect(second.body.data.attempt.expiresAt).toBe(first.body.data.attempt.expiresAt);
    });
  });

  describe('authoring rules', () => {
    it('refuses to delete a question that has already been used in an attempt', async () => {
      const admin = await createUser({ email: 'delq-admin@example.com', role: 'admin' });
      const student = await createUser({ email: 'delq-student@example.com', role: 'student' });
      const skills = await seedTestSkills();
      const q1 = await seedTestQuestion({ skillId: skills.PROGRAMMING_FUNDAMENTALS }, admin.id);
      const assessmentId = await seedTestAssessment({ questionIds: [q1], authorId: admin.id });

      const auth = authed(await loginAs(student.email));
      const created = await auth.post('/api/v1/attempts').send({ assessmentId }).expect(201);
      await auth.post(`/api/v1/attempts/${created.body.data.attempt.id}/submit`).send({ confirm: true });

      const adminAuth = authed(await loginAs(admin.email));
      const response = await adminAuth.delete(`/api/v1/questions/${q1}`).expect(409);
      expect(response.body.message).toMatch(/history/i);
    });

    it('refuses to delete an assessment that has recorded attempts', async () => {
      const { assessmentId, student, studentAuth } = await setup({ questionCount: 1 });
      const created = await studentAuth.post('/api/v1/attempts').send({ assessmentId }).expect(201);
      await studentAuth.post(`/api/v1/attempts/${created.body.data.attempt.id}/submit`).send({ confirm: true });

      const admin = await createUser({ email: 'dela-admin@example.com', role: 'admin' });
      const adminAuth = authed(await loginAs(admin.email));
      const response = await adminAuth.delete(`/api/v1/assessments/${assessmentId}`).expect(409);
      expect(response.body.message).toMatch(/archive/i);
      void student;
    });

    it('refuses to change the scoring data of a question already used in an attempt', async () => {
      const admin = await createUser({ email: 'editq-admin@example.com', role: 'admin' });
      const student = await createUser({ email: 'editq-student@example.com', role: 'student' });
      const skills = await seedTestSkills();
      const q1 = await seedTestQuestion({ skillId: skills.PROGRAMMING_FUNDAMENTALS }, admin.id);
      const assessmentId = await seedTestAssessment({ questionIds: [q1], authorId: admin.id });

      const studentAuth = authed(await loginAs(student.email));
      const created = await studentAuth.post('/api/v1/attempts').send({ assessmentId }).expect(201);
      await studentAuth.post(`/api/v1/attempts/${created.body.data.attempt.id}/submit`).send({ confirm: true });

      const adminAuth = authed(await loginAs(admin.email));
      const response = await adminAuth.patch(`/api/v1/questions/${q1}`).send({ correctOptionId: 'b' }).expect(409);
      expect(response.body.message).toMatch(/historical results/i);
    });

    it('refuses to publish an assessment with an insufficient question pool', async () => {
      const admin = await createUser({ email: 'pub2-admin@example.com', role: 'admin' });
      const skills = await seedTestSkills();
      const q1 = await seedTestQuestion({ skillId: skills.PROGRAMMING_FUNDAMENTALS }, admin.id);
      const assessmentId = await seedTestAssessment({
        questionIds: [q1],
        questionCount: 1,
        authorId: admin.id,
        status: 'draft',
      });

      const auth = authed(await loginAs(admin.email));
      await auth.patch(`/api/v1/assessments/${assessmentId}`).send({ questionCount: 5 }).expect(422);

      await auth
        .patch(`/api/v1/questions/${q1}/status`)
        .send({ isActive: false })
        .expect(200);
      await auth.patch(`/api/v1/assessments/${assessmentId}/status`).send({ status: 'published' }).expect(422);
    });

    it('rejects a career creation request that references a non-existent skill', async () => {
      const admin = await createUser({ email: 'badcareer-admin@example.com', role: 'admin' });
      const auth = authed(await loginAs(admin.email));
      await auth
        .post('/api/v1/careers')
        .send({
          title: 'Broken Career',
          category: 'Test',
          description: 'This description is definitely long enough to pass validation rules.',
          requiredSkills: [{ skill: '0123456789abcdef01234567', requiredLevel: 50, weight: 1 }],
        })
        .expect(422);
    });

    it('creates a valid career definition', async () => {
      const admin = await createUser({ email: 'career-admin@example.com', role: 'admin' });
      const skills = await seedTestSkills();
      const careerId = await seedTestCareer({
        title: 'Fixture Engineer',
        slug: 'fixture-engineer',
        requirements: [{ skillId: skills.PROGRAMMING_FUNDAMENTALS, skillCode: 'PROGRAMMING_FUNDAMENTALS', skillName: 'Programming Fundamentals' }],
      });
      expect(careerId).toBeTruthy();

      const auth = authed(await loginAs(admin.email));
      const response = await auth.get(`/api/v1/careers/${careerId}`).expect(200);
      expect(response.body.data.career.title).toBe('Fixture Engineer');
    });
  });
});

void request;
