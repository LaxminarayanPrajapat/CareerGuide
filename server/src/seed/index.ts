/**
 * Repeatable seed script.
 *
 * Every record is upserted on a stable natural key (skill code, career slug,
 * assessment title, question seed key), so running it repeatedly never creates
 * duplicates and never destroys candidate data.
 *
 * Usage:
 *   npm run seed            - upsert sample data
 *   npm run seed:reset      - wipe application collections first, then seed
 */

import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { SKILLS } from './data/skills.js';
import { QUESTIONS } from './data/questions.js';
import { CAREERS } from './data/careers.js';
import { SkillModel } from '../models/Skill.js';
import { CareerModel } from '../models/Career.js';
import { QuestionModel } from '../models/Question.js';
import { AssessmentModel } from '../models/Assessment.js';
import { AssessmentCategoryModel } from '../models/AssessmentCategory.js';
import { UserModel } from '../models/User.js';
import { AttemptModel } from '../models/Attempt.js';
import { AnswerModel } from '../models/Answer.js';
import { CareerReportModel } from '../models/CareerReport.js';
import { RoadmapModel } from '../models/Roadmap.js';
import { CandidateSkillProfileModel, SkillProfileRevisionModel } from '../models/CandidateSkillProfile.js';
import { SystemSettingModel } from '../models/SystemSetting.js';
import { AuditLogModel } from '../models/auditLog.js';
import { hashPassword } from '../utils/password.js';
import { logger } from '../utils/logger.js';

const reset = process.argv.includes('--reset');
const skipDemoUsers = process.argv.includes('--no-users');

const CATEGORY_META = [
  { key: 'aptitude', name: 'Aptitude', description: 'Numerical, verbal and general reasoning aptitude measured with timed multiple-choice questions.', color: '#2563eb', icon: 'Calculator', scoringModel: 'objective', displayOrder: 1 },
  { key: 'logical_reasoning', name: 'Logical Reasoning', description: 'Pattern recognition, deductive reasoning and problem-solving items.', color: '#0f766e', icon: 'Puzzle', scoringModel: 'objective', displayOrder: 2 },
  { key: 'technical_knowledge', name: 'Technical Knowledge', description: 'Programming, web development, database and software-testing fundamentals.', color: '#7c3aed', icon: 'Code2', scoringModel: 'objective', displayOrder: 3 },
  { key: 'domain_knowledge', name: 'Domain Knowledge', description: 'Applied knowledge for data, security, cloud, design and business roles.', color: '#c2410c', icon: 'Compass', scoringModel: 'objective', displayOrder: 4 },
  { key: 'personality', name: 'Personality & Working Preferences', description: 'Indicative working-preference statements. Not scored as right or wrong, and not a psychological assessment.', color: '#be123c', icon: 'Users', scoringModel: 'preference', displayOrder: 5 },
] as const;

const DEMO_USERS = [
  { fullName: 'System Administrator', email: 'admin@careerguide.local', role: 'admin', password: 'Admin@12345' },
  { fullName: 'Priya Sharma', email: 'counsellor@careerguide.local', role: 'counsellor', password: 'Counsellor@12345' },
  { fullName: 'Ravi Menon', email: 'management@careerguide.local', role: 'management', password: 'Management@12345' },
  { fullName: 'Aarav Kumar', email: 'student@careerguide.local', role: 'student', password: 'Student@12345' },
  { fullName: 'Diya Patel', email: 'diya.patel@careerguide.local', role: 'student', password: 'Student@12345' },
  { fullName: 'Rohan Mehta', email: 'rohan.mehta@careerguide.local', role: 'student', password: 'Student@12345' },
  { fullName: 'Ananya Nair', email: 'ananya.nair@careerguide.local', role: 'student', password: 'Student@12345' },
] as const;

async function wipe(): Promise<void> {
  logger.warn('seed.reset_requested', { note: 'All application collections are being cleared.' });
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
  logger.info('seed.reset_complete');
}

async function seedCategories(): Promise<void> {
  for (const category of CATEGORY_META) {
    await AssessmentCategoryModel.updateOne(
      { key: category.key },
      { $set: { ...category, isActive: true, isSample: true }, $setOnInsert: {} },
      { upsert: true },
    );
  }
  logger.info('seed.categories', { count: CATEGORY_META.length });
}

async function seedSkills(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const skill of SKILLS) {
    await SkillModel.updateOne(
      { code: skill.code },
      { $set: { ...skill, code: skill.code, isActive: true, isSample: true } },
      { upsert: true },
    );
    const stored = await SkillModel.findOne({ code: skill.code }).select('_id').lean();
    ids.set(skill.code, String(stored!._id));
  }
  logger.info('seed.skills', { count: SKILLS.length });
  return ids;
}

async function seedCareers(skillIds: Map<string, string>): Promise<Map<string, string>> {
  const slugs: string[] = [];
  const ids = new Map<string, string>();

  for (const career of CAREERS) {
    slugs.push(career.slug);
    const requiredSkills = career.requiredSkills.map((requirement) => {
      const skillId = skillIds.get(requirement.skillCode);
      if (!skillId) throw new Error(`Career "${career.slug}" references unknown skill ${requirement.skillCode}`);
      return {
        skill: skillId,
        skillCode: requirement.skillCode,
        skillName: SKILLS.find((s) => s.code === requirement.skillCode)?.name ?? requirement.skillCode,
        requiredLevel: requirement.requiredLevel,
        weight: requirement.weight,
        importance: requirement.importance,
        developmentFocus: requirement.developmentFocus,
      };
    });

    await CareerModel.updateOne(
      { slug: career.slug },
      {
        $set: {
          slug: career.slug,
          title: career.title,
          category: career.category,
          description: career.description,
          responsibilities: career.responsibilities,
          requiredSkills,
          aptitudeFit: career.aptitudeFit,
          preferenceFit: career.preferenceFit,
          prerequisites: career.prerequisites,
          learningStages: career.learningStages,
          suggestedProjects: career.suggestedProjects,
          isActive: true,
          isSample: true,
          sourceNote:
            'Sample career definition seeded for academic demonstration. Illustrative only - not an exhaustive or ranked list of careers.',
        },
      },
      { upsert: true },
    );
    const stored = await CareerModel.findOne({ slug: career.slug }).select('_id').lean();
    ids.set(career.slug, String(stored!._id));
  }

  // Second pass so related-career references resolve to real ids.
  for (const career of CAREERS) {
    const related = career.relatedCareerSlugs.map((slug) => ids.get(slug)).filter(Boolean);
    await CareerModel.updateOne({ slug: career.slug }, { $set: { relatedCareers: related } });
  }

  logger.info('seed.careers', { count: CAREERS.length });
  return ids;
}

async function seedQuestions(
  skillIds: Map<string, string>,
  authorId: string,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  for (const question of QUESTIONS) {
    const seedKey = question.key;
    const skillMappings = question.skillCodes
      .map((code) => skillIds.get(code))
      .filter(Boolean)
      .map((skill) => ({ skill, weight: 1 }));

    const payload = {
      text: question.text,
      category: question.category,
      topic: question.topic,
      questionType: question.questionType,
      options: question.options ?? [],
      correctOptionId: question.correctOptionId,
      preferenceDimension: question.preferenceDimension,
      scaleMin: question.scaleMin,
      scaleMax: question.scaleMax,
      explanation: question.explanation,
      difficulty: question.difficulty,
      skillMappings,
      marks: question.marks,
      isActive: true,
      isSample: true,
      author: authorId,
    };

    // `text` is unique enough within the sample set to use as the natural key.
    await QuestionModel.updateOne({ text: question.text }, { $set: payload }, { upsert: true });
    const stored = await QuestionModel.findOne({ text: question.text }).select('_id').lean();
    ids.set(seedKey, String(stored!._id));
  }

  logger.info('seed.questions', { count: QUESTIONS.length });
  return ids;
}

interface SeedAssessment {
  title: string;
  description: string;
  instructions: string;
  category: string;
  questionKeys: string[];
  questionCount: number;
  durationMinutes: number;
  marksPerQuestion: number;
  passingPercentage: number;
  status: 'draft' | 'published';
  scoringNote?: string;
}

const ASSESSMENTS: SeedAssessment[] = [
  {
    title: 'Sample Aptitude Test',
    description: 'Measures numerical and verbal aptitude using short, timed multiple-choice questions.',
    instructions:
      'You will have a fixed amount of time to complete this assessment. The timer is enforced by the server and continues even if you close the browser. You may move between questions, flag questions for review, and change answers until you submit. Once submitted, an attempt cannot be changed. Attempt limit: 2.',
    category: 'aptitude',
    questionKeys: [
      'apt-num-01', 'apt-num-02', 'apt-num-03', 'apt-num-04', 'apt-num-05',
      'apt-verb-01', 'apt-verb-02', 'apt-verb-03',
    ],
    questionCount: 8,
    durationMinutes: 12,
    marksPerQuestion: 1,
    passingPercentage: 40,
    status: 'published',
  },
  {
    title: 'Sample Logical Reasoning Test',
    description: 'Measures pattern recognition, deductive reasoning, analogy and spatial reasoning.',
    instructions:
      'This is a timed assessment. The server enforces the deadline, so the timer keeps running if you refresh or close the page. Review your flagged questions before submitting. Scores are calculated on the server from the answer key.',
    category: 'logical_reasoning',
    questionKeys: [
      'log-pat-01', 'log-pat-02', 'log-ded-01', 'log-ded-02', 'log-ana-01', 'log-ana-02',
      'log-spa-01', 'log-spa-02', 'log-prob-01',
    ],
    questionCount: 9,
    durationMinutes: 15,
    marksPerQuestion: 1,
    passingPercentage: 45,
    status: 'published',
  },
  {
    title: 'Sample Technical Knowledge Test',
    description: 'Covers programming fundamentals, object-oriented concepts, web development, databases, version control and testing.',
    instructions:
      'Choose the single best answer for each item. The timer is server-enforced and your answers are saved as you go. You have two attempts at this assessment.',
    category: 'technical_knowledge',
    questionKeys: [
      'tech-prog-01', 'tech-prog-02', 'tech-prog-03', 'tech-oop-01', 'tech-oop-02',
      'tech-web-01', 'tech-web-02', 'tech-web-03', 'tech-db-01', 'tech-db-02',
      'tech-db-03', 'tech-git-01', 'tech-git-02', 'tech-algo-01', 'tech-test-01',
    ],
    questionCount: 10,
    durationMinutes: 20,
    marksPerQuestion: 1,
    passingPercentage: 50,
    status: 'published',
  },
  {
    title: 'Sample Domain Knowledge Test',
    description: 'Applied knowledge across data analytics, statistics, machine learning, networking, cloud, security, design and business analysis.',
    instructions:
      'This assessment uses the same timed rules as the other tests. Read each scenario carefully and select the best answer. There is no penalty for a wrong answer.',
    category: 'domain_knowledge',
    questionKeys: [
      'dom-data-01', 'dom-data-02', 'dom-stats-01', 'dom-stats-02', 'dom-ml-01', 'dom-ml-02',
      'dom-net-01', 'dom-net-02', 'dom-cloud-01', 'dom-cloud-02',
      'dom-sec-01', 'dom-sec-02', 'dom-sec-03', 'dom-ui-01', 'dom-ui-02',
      'dom-ux-01', 'dom-ba-01', 'dom-pm-01', 'dom-pm-02', 'dom-comm-01', 'dom-comm-02',
    ],
    questionCount: 12,
    durationMinutes: 20,
    marksPerQuestion: 1,
    passingPercentage: 45,
    status: 'published',
  },
  {
    title: 'Sample Working Preferences Questionnaire',
    description:
      'An indicative questionnaire about working preferences. There are no right or wrong answers and no pass mark.',
    instructions:
      'Rate how far you agree with each statement on a five-point scale. Answer honestly rather than ideally - this instrument is used only to describe working preferences, never to judge ability. There is no pass mark and no time pressure beyond the session length. Results are reported as indicative preferences, not as a diagnosis or personality type.',
    category: 'personality',
    questionKeys: [
      'pers-analytical-01', 'pers-analytical-02', 'pers-creative-01', 'pers-creative-02',
      'pers-structured-01', 'pers-structured-02', 'pers-collab-01', 'pers-collab-02',
      'pers-leadership-01', 'pers-leadership-02', 'pers-detail-01', 'pers-detail-02',
      'pers-explore-01', 'pers-explore-02',
    ],
    questionCount: 14,
    durationMinutes: 10,
    marksPerQuestion: 1,
    passingPercentage: 0,
    status: 'published',
    scoringNote:
      'Preference instrument. Each response contributes points to a declared working-preference dimension. Results are aggregated into normalised preference scores and are never reported as right or wrong.',
  },
  {
    title: 'Draft: Advanced Data Reasoning (unpublished example)',
    description:
      'A draft test set that demonstrates the unpublished state. It is not visible to candidates until an administrator publishes it.',
    instructions: 'Draft test set - visible to administrators and counsellors only until published.',
    category: 'logical_reasoning',
    questionKeys: ['log-ana-01', 'log-ded-02', 'log-prob-01'],
    questionCount: 3,
    durationMinutes: 8,
    marksPerQuestion: 2,
    passingPercentage: 50,
    status: 'draft',
  },
];

async function seedAssessments(questionIds: Map<string, string>, creatorId: string): Promise<void> {
  for (const assessment of ASSESSMENTS) {
    const pool = assessment.questionKeys
      .map((key) => questionIds.get(key))
      .filter((id): id is string => Boolean(id));
    if (pool.length === 0) {
      logger.warn('seed.assessment_skipped', { title: assessment.title, reason: 'No matching questions.' });
      continue;
    }

    const totalMarks = Math.round(assessment.questionCount * assessment.marksPerQuestion * 100) / 100;
    await AssessmentModel.updateOne(
      { title: assessment.title },
      {
        $set: {
          title: assessment.title,
          description: assessment.description,
          instructions: assessment.instructions,
          category: assessment.category,
          questionPool: pool,
          questionCount: assessment.questionCount,
          durationMinutes: assessment.durationMinutes,
          marksPerQuestion: assessment.marksPerQuestion,
          totalMarks,
          passingPercentage: assessment.passingPercentage,
          shuffleQuestions: true,
          shuffleOptions: true,
          shuffleAtAttempt: true,
          maxAttempts: 2,
          status: assessment.status,
          assignedBatches: [],
          createdBy: creatorId,
          isSample: true,
          scoringNote:
            assessment.scoringNote ??
            'Objectively scored: marks are awarded on the server from the configured answer key.',
        },
      },
      { upsert: true },
    );
  }
  logger.info('seed.assessments', { count: ASSESSMENTS.length });
}

async function seedUsers(): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};

  for (const demo of DEMO_USERS) {
    const existing = await UserModel.findOne({ email: demo.email }).select('_id').lean();
    if (existing) {
      ids[demo.role] = String(existing._id);
      continue;
    }
    const created = await UserModel.create({
      fullName: demo.fullName,
      email: demo.email,
      passwordHash: await hashPassword(demo.password),
      role: demo.role,
      isActive: true,
      mustChangePassword: false,
      studentProfile:
        demo.role === 'student'
          ? {
              institution: 'Sample Institute of Technology',
              department: 'Master of Computer Applications',
              yearOfStudy: 3,
              batch: 'MCA-2024-A',
              rollNumber: 'MCA24001',
              graduationYear: 2026,
              objective: 'Sample candidate profile created by the development seed script.',
              skillsInterests: ['Software development', 'Problem solving'],
            }
          : {},
    });
    ids[demo.role] = String(created._id);
  }

  // Assign every sample student to the sample counsellor.
  if (ids.counsellor) {
    await UserModel.updateMany(
      { role: 'student', assignedCounsellor: { $exists: false } },
      { $set: { assignedCounsellor: ids.counsellor } },
    );
  }

  logger.info('seed.users', { count: DEMO_USERS.length });
  return ids;
}

async function seedSettings(): Promise<void> {
  const settings = [
    { key: 'general.siteName', value: 'AI Career Guide', valueType: 'string', category: 'general', label: 'Site name', description: 'Shown in the header and on printed reports.' },
    { key: 'general.assessmentNotice', value: 'Assessments are timed and scored on the server. Once submitted, an attempt cannot be changed.', valueType: 'string', category: 'general', label: 'Assessment notice', description: 'Message shown before a candidate starts an attempt.' },
    { key: 'assessment.defaultPassPercentage', value: 40, valueType: 'number', category: 'assessment', label: 'Default passing percentage', description: 'Used when an administrator does not set a threshold.' },
    { key: 'assessment.showExplanations', value: true, valueType: 'boolean', category: 'assessment', label: 'Show explanations after submission', description: 'Whether answer explanations are revealed in the result review.' },
    { key: 'report.minDataCoverage', value: 0.4, valueType: 'number', category: 'report', label: 'Minimum data coverage', description: 'Coverage below which a report is marked low confidence.' },
  ];
  for (const setting of settings) {
    await SystemSettingModel.updateOne({ key: setting.key }, { $set: { ...setting, isSecretBacked: false } }, { upsert: true });
  }
  logger.info('seed.settings', { count: settings.length });
}

export async function runSeed(): Promise<void> {
  await connectDatabase();
  if (reset) await wipe();

  await seedCategories();

  const userIds = skipDemoUsers ? {} : await seedUsers();
  // Fall back to any existing administrator so authored records always have an author.
  const fallbackAdmin =
    userIds.admin ??
    String((await UserModel.findOne({ role: 'admin' }).select('_id').lean())?._id ?? '');

  const skillIds = await seedSkills();
  await seedCareers(skillIds);

  if (!fallbackAdmin) {
    logger.warn('seed.questions_skipped', {
      reason: 'No administrator account exists. Start the server once or run the seed without --no-users so questions have an author.',
    });
  } else {
    const questionIds = await seedQuestions(skillIds, fallbackAdmin);
    await seedAssessments(questionIds, fallbackAdmin);
  }

  await seedSettings();

  logger.info('seed.complete', { reset, skippedUsers: skipDemoUsers });
}

async function main(): Promise<void> {
  try {
    await runSeed();
    // eslint-disable-next-line no-console
    console.log('\n  Seed completed.\n');
    if (!skipDemoUsers) {
      // eslint-disable-next-line no-console
      console.log('  Development-only demo accounts (do not use in production):');
      for (const user of DEMO_USERS) {
        // eslint-disable-next-line no-console
        console.log(`    ${user.role.padEnd(11)} ${user.email.padEnd(34)} ${user.password}`);
      }
      // eslint-disable-next-line no-console
      console.log('');
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Seed failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}

void main();
