import mongoose from 'mongoose';
import type { Application } from 'express';
import request from 'supertest';
import { createApp } from '../app.js';
import { UserModel } from '../models/User.js';
import { SkillModel } from '../models/Skill.js';
import { CareerModel } from '../models/Career.js';
import { QuestionModel } from '../models/Question.js';
import { AssessmentModel } from '../models/Assessment.js';
import { AssessmentCategoryModel } from '../models/AssessmentCategory.js';
import { AttemptModel } from '../models/Attempt.js';
import { AnswerModel } from '../models/Answer.js';
import { CareerReportModel } from '../models/CareerReport.js';
import { RoadmapModel } from '../models/Roadmap.js';
import { CandidateSkillProfileModel, SkillProfileRevisionModel } from '../models/CandidateSkillProfile.js';
import { SystemSettingModel } from '../models/SystemSetting.js';
import { AuditLogModel } from '../models/auditLog.js';
import { hashPassword } from '../utils/password.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';

export const TEST_PASSWORD = 'Test@12345';

let app: Application | null = null;

export function getApp(): Application {
  if (!app) {
    configureTestEnv();
    app = createApp();
  }
  return app;
}

/** Must run before `createApp()` so the config module reads test values. */
function configureTestEnv(): void {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-only-secret-that-is-long-enough-for-hs256-signing';
  process.env.MONGODB_URI = process.env.TEST_MONGODB_URI ?? 'mongodb://127.0.0.1:27017/career_guide_test';
  process.env.CLIENT_ORIGIN = 'http://localhost:5173';
  process.env.COOKIE_SECURE = 'false';
  process.env.LOG_LEVEL = 'error';
  process.env.AI_PROVIDER = 'none';
}

export async function connectTestDatabase(): Promise<void> {
  configureTestEnv();
  await connectDatabase();
}

export async function clearDatabase(): Promise<void> {
  await Promise.all([
    UserModel.deleteMany({}),
    AttemptModel.deleteMany({}),
    AnswerModel.deleteMany({}),
    CareerReportModel.deleteMany({}),
    RoadmapModel.deleteMany({}),
    CandidateSkillProfileModel.deleteMany({}),
    SkillProfileRevisionModel.deleteMany({}),
    QuestionModel.deleteMany({}),
    AssessmentModel.deleteMany({}),
    CareerModel.deleteMany({}),
    SkillModel.deleteMany({}),
    AssessmentCategoryModel.deleteMany({}),
    SystemSettingModel.deleteMany({}),
    AuditLogModel.deleteMany({}),
  ]);
}

export async function closeTestDatabase(): Promise<void> {
  await disconnectDatabase();
  await mongoose.connection.close().catch(() => undefined);
}

/** Issues a request that carries the session cookie and CSRF token. */
export async function loginAs(email: string, password = TEST_PASSWORD) {
  const agent = request.agent(getApp());
  const response = await agent.post('/api/v1/auth/login').send({ email, password });
  if (response.status !== 200) {
    throw new Error(`Login failed for ${email}: ${response.status} ${JSON.stringify(response.body)}`);
  }
  const setCookie = (response.headers['set-cookie'] ?? []) as unknown as string[];
  const csrf = setCookie
    .flatMap((cookie) => cookie.split(/,(?=[^;]+?=)/))
    .map((cookie) => cookie.split(';')[0].trim())
    .find((cookie) => cookie.startsWith('cgs_csrf='))
    ?.split('=')[1];

  return {
    agent,
    csrf,
    userId: response.body.data.user.id as string,
    role: response.body.data.user.role as string,
  };
}

/** Authenticated request helper: adds cookie + CSRF header automatically. */
export function authed(session: { agent: request.Agent; csrf: string }) {
  return {
    get: (url: string) => session.agent.get(url),
    post: (url: string) => session.agent.post(url).set('X-CSRF-Token', session.csrf ?? ''),
    put: (url: string) => session.agent.put(url).set('X-CSRF-Token', session.csrf ?? ''),
    patch: (url: string) => session.agent.patch(url).set('X-CSRF-Token', session.csrf ?? ''),
    delete: (url: string) => session.agent.delete(url).set('X-CSRF-Token', session.csrf ?? ''),
  };
}

export interface TestUser {
  email: string;
  role: 'admin' | 'counsellor' | 'management' | 'student';
  id: string;
}

export async function createUser(options: {
  email: string;
  role: 'admin' | 'counsellor' | 'management' | 'student';
  fullName?: string;
  assignedCounsellor?: string;
  studentProfile?: Record<string, unknown>;
}): Promise<TestUser> {
  const user = await UserModel.create({
    fullName: options.fullName ?? `Test ${options.role}`,
    email: options.email,
    passwordHash: await hashPassword(TEST_PASSWORD),
    role: options.role,
    isActive: true,
    assignedCounsellor: options.assignedCounsellor,
    studentProfile: options.studentProfile ?? {},
  });
  return { email: options.email, role: options.role, id: String(user._id) };
}

export async function seedTestSkills(): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  const skills = [
    { code: 'LOGICAL_REASONING', name: 'Logical Reasoning', category: 'aptitude' },
    { code: 'NUMERICAL_APTITUDE', name: 'Numerical Aptitude', category: 'aptitude' },
    { code: 'PROGRAMMING_FUNDAMENTALS', name: 'Programming Fundamentals', category: 'technical' },
    { code: 'DATABASE_CONCEPTS', name: 'Database Concepts', category: 'technical' },
    { code: 'COMMUNICATION', name: 'Communication', category: 'communication' },
    { code: 'CRITICAL_THINKING', name: 'Critical Thinking', category: 'professional' },
  ];
  for (const skill of skills) {
    const created = await SkillModel.create({
      ...skill,
      description: `${skill.name} test fixture.`,
      measurementUnit: 'percent',
      isActive: true,
    });
    ids[skill.code] = String(created._id);
  }
  return ids;
}

export interface TestQuestionSpec {
  skillId: string;
  correctOptionId?: string;
  marks?: number;
  category?: string;
  text?: string;
}

/** Creates a minimal, valid MCQ question. */
export async function seedTestQuestion(spec: TestQuestionSpec, authorId: string): Promise<string> {
  const question = await QuestionModel.create({
    text: spec.text ?? `Test question ${Math.random().toString(36).slice(2, 10)}`,
    category: spec.category ?? 'logical_reasoning',
    topic: 'Test topic',
    questionType: 'mcq',
    options: [
      { optionId: 'a', text: 'Option A' },
      { optionId: 'b', text: 'Option B' },
      { optionId: 'c', text: 'Option C' },
      { optionId: 'd', text: 'Option D' },
    ],
    correctOptionId: spec.correctOptionId ?? 'a',
    difficulty: 'medium',
    skillMappings: [{ skill: spec.skillId, weight: 1 }],
    marks: spec.marks ?? 1,
    isActive: true,
    author: authorId,
  });
  return String(question._id);
}

/** Creates a minimal, valid preference (likert) question. */
export async function seedTestPreferenceQuestion(
  dimension: string,
  skillId: string,
  authorId: string,
): Promise<string> {
  const question = await QuestionModel.create({
    text: `Test preference statement ${Math.random().toString(36).slice(2, 8)}`,
    category: 'personality',
    topic: 'Working preferences',
    questionType: 'likert',
    options: [
      { optionId: '1', text: 'Disagree', preferencePoints: -1 },
      { optionId: '2', text: 'Neutral', preferencePoints: 0 },
      { optionId: '3', text: 'Agree', preferencePoints: 1 },
    ],
    preferenceDimension: dimension,
    scaleMin: 1,
    scaleMax: 3,
    difficulty: 'medium',
    skillMappings: [{ skill: skillId, weight: 1 }],
    marks: 1,
    isActive: true,
    author: authorId,
  });
  return String(question._id);
}

export async function seedTestAssessment(options: {
  questionIds: string[];
  title?: string;
  category?: string;
  durationMinutes?: number;
  questionCount?: number;
  status?: 'draft' | 'published';
  authorId: string;
  maxAttempts?: number;
}): Promise<string> {
  const questionCount = options.questionCount ?? options.questionIds.length;
  const assessment = await AssessmentModel.create({
    title: options.title ?? `Test assessment ${Math.random().toString(36).slice(2, 8)}`,
    description: 'Fixture assessment used by the automated tests.',
    instructions: 'Answer every question, then submit.',
    category: options.category ?? 'logical_reasoning',
    questionPool: options.questionIds,
    questionCount,
    durationMinutes: options.durationMinutes ?? 30,
    marksPerQuestion: 1,
    totalMarks: questionCount,
    passingPercentage: 40,
    shuffleQuestions: false,
    shuffleOptions: false,
    shuffleAtAttempt: false,
    maxAttempts: options.maxAttempts ?? 2,
    status: options.status ?? 'published',
    assignedBatches: [],
    createdBy: options.authorId,
  });
  return String(assessment._id);
}

export async function seedTestCareer(options: {
  title: string;
  slug: string;
  requirements: Array<{ skillId: string; skillCode: string; skillName: string; requiredLevel?: number; weight?: number }>;
}): Promise<string> {
  const career = await CareerModel.create({
    slug: options.slug,
    title: options.title,
    category: 'Test category',
    description: 'Fixture career definition used by the automated tests.',
    responsibilities: [],
    requiredSkills: options.requirements.map((r) => ({
      skill: r.skillId,
      skillCode: r.skillCode,
      skillName: r.skillName,
      requiredLevel: r.requiredLevel ?? 50,
      weight: r.weight ?? 1,
      importance: 'core',
      developmentFocus: 'Improve this competency.',
    })),
    aptitudeFit: [],
    preferenceFit: [],
    prerequisites: [],
    learningStages: [],
    relatedCareers: [],
    suggestedProjects: [],
    isActive: true,
  });
  return String(career._id);
}
