export type Role = 'admin' | 'counsellor' | 'management' | 'student';

export type AssessmentCategory =
  | 'aptitude'
  | 'logical_reasoning'
  | 'technical_knowledge'
  | 'domain_knowledge'
  | 'personality';

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  isActive: boolean;
  phone: string | null;
  studentProfile: {
    institution?: string;
    department?: string;
    yearOfStudy?: number;
    rollNumber?: string;
    batch?: string;
    graduationYear?: number;
    objective?: string;
    linkedinUrl?: string;
    portfolioUrl?: string;
    skillsInterests?: string[];
    completionPercent?: number;
  };
  assignedCounsellor: string | null;
  lastLoginAt: string | null;
  createdAt: string | null;
  mustChangePassword: boolean;
  permissions: string[];
}

export interface ApiMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  code?: string;
  timestamp?: string;
  path?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: ApiMeta;
  errors?: Array<{ field: string; message: string }>;
}

export interface AssessmentSummary {
  id: string;
  title: string;
  description: string;
  instructions: string;
  category: AssessmentCategory;
  questionCount: number;
  durationMinutes: number;
  marksPerQuestion: number;
  totalMarks: number;
  passingPercentage: number;
  maxAttempts: number;
  status: 'draft' | 'published' | 'archived';
  availableFrom: string | null;
  availableUntil: string | null;
  scoringNote: string;
  attemptCount: number;
  poolSize?: number;
  assignedBatches?: string[];
  createdAt?: string;
}

export interface AvailableAssessment extends AssessmentSummary {
  attemptsUsed: number;
  attemptsRemaining: number;
  liveAttemptId: string | null;
  eligible: boolean;
  batchRestricted: boolean;
}

export interface AttemptQuestion {
  id: string;
  text: string;
  topic: string;
  questionType: 'mcq' | 'likert';
  options: Array<{ optionId: string; text: string }>;
  scaleMin?: number;
  scaleMax?: number;
  marks: number;
  displayIndex: number;
}

export interface AttemptPayload {
  attempt: {
    id: string;
    assessmentId: string;
    assessmentTitle: string;
    category: AssessmentCategory;
    status: string;
    startedAt: string;
    expiresAt: string;
    durationMinutes: number;
    totalQuestions: number;
    totalMarks: number;
    answeredCount: number;
    flaggedCount: number;
    serverTime: string;
    secondsRemaining: number;
    isFinalised: boolean;
  };
  questions: AttemptQuestion[];
  savedAnswers: Array<{ questionId: string; selectedOptionId?: string; isFlagged: boolean }>;
}

export interface AttemptReviewItem {
  questionId: string;
  text: string;
  topic: string;
  questionType: string;
  selectedOptionId: string | null;
  correctOptionId: string | null;
  isCorrect: boolean | null;
  marksAwarded: number | null;
  marksPossible: number;
  evaluationStatus: 'scored' | 'preference' | 'invalid' | 'unanswered';
  invalidReason: string | null;
  explanation: string | null;
}

export interface AttemptResult {
  id: string;
  assessmentId: string;
  assessmentTitle: string;
  category: AssessmentCategory;
  scoringModel: 'objective' | 'preference';
  status: string;
  submissionReason: string | null;
  startedAt: string;
  submittedAt: string | null;
  timeSpentSeconds: number;
  totalQuestions: number;
  answeredCount: number;
  marksObtained: number | null;
  totalMarks: number | null;
  /** Denominator actually used for the score; lower when items were excluded. */
  scorableMarks: number | null;
  percentage: number | null;
  passed: boolean | null;
  invalidItemCount: number;
  skillResults: Array<{
    skill: string;
    skillCode: string;
    skillName: string;
    marksObtained: number;
    marksPossible: number;
    score: number;
    evidenceCount: number;
  }>;
  preferenceResults: Array<{
    dimension: string;
    rawPoints: number;
    maxPoints: number;
    normalisedScore: number;
    itemsAnswered: number;
  }>;
  review: AttemptReviewItem[];
}

export interface SkillMeasurement {
  skillId: string;
  code: string;
  name: string;
  category: string;
  score: number;
  evidence: number;
  observations: number;
  lastUpdatedAt: string;
}

export interface CompatibilityEvidence {
  requirementIndex: number;
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
  evidence: CompatibilityEvidence[];
  gaps: Array<{ skillCode: string; skillName: string; gap: number; priority: 'high' | 'medium' | 'low' }>;
  strengths: Array<{ skillCode: string; skillName: string; measured: number; required: number }>;
  insufficientData: boolean;
  deterministicSummary: string;
}

export interface ReportRecommendation {
  career: string;
  careerSlug: string;
  careerTitle: string;
  careerCategory: string;
  compatibilityScore: number;
  confidence: 'low' | 'moderate' | 'good';
  dataCoverage: number;
  skillFitScore: number;
  aptitudeFitScore: number;
  preferenceFitScore: number;
  evidence: CompatibilityEvidence[];
  deterministicSummary: string;
  aiExplanation?: string;
  topGaps: Array<{ skillCode: string; skillName: string; gap: number; priority: string }>;
}

export interface CareerReport {
  id: string;
  reportNumber: string;
  candidateId: string;
  scoringVersion: string;
  generatedAt: string;
  skillProfileRevision: number;
  dataCoverage: number;
  completedAssessments: number;
  skillSnapshot: Array<{ skill: string; skillCode: string; skillName: string; score: number; evidence: number }>;
  strongestSkills: Array<{ skillCode: string; skillName: string; score: number }>;
  weakestSkills: Array<{ skillCode: string; skillName: string; score: number }>;
  unmeasuredSkillCodes: string[];
  recommendations: ReportRecommendation[];
  preferenceProfile: Array<{ dimension: string; score: number; itemsAnswered: number }>;
  aiNarrative: {
    overview?: string;
    strengths?: string[];
    developmentAreas?: string[];
    careerRationale?: Record<string, string>;
    roadmapGuidance?: Record<string, string[]>;
    motivationNotes?: string[];
  } | null;
  generationStatus: 'pending' | 'completed' | 'failed';
  aiProviderUsed: string;
  aiFailureReason: string | null;
  inputAssessments: Array<{ assessment: string; title: string; category: string; percentage: number }>;
  disclaimer: string;
}

export interface RoadmapItem {
  id: string;
  order: number;
  title: string;
  description: string;
  skillCode: string | null;
  kind: 'learn' | 'practice' | 'project' | 'milestone' | 'assess';
  stage: 'beginner' | 'intermediate' | 'advanced';
  estimatedHours: number;
  completionCriteria: string;
  resourceLinks: Array<{ title: string; url: string }>;
  status: 'not_started' | 'in_progress' | 'completed';
  startedAt: string | null;
  completedAt: string | null;
}

export interface Roadmap {
  id: string;
  candidateId: string;
  careerId: string;
  reportId: string;
  scoringVersion: string;
  title: string;
  summary: string;
  currentDemonstratedSkills: Array<{ skillCode: string; skillName: string; score: number }>;
  priorityGaps: Array<{ skillCode: string; skillName: string; gap: number; priority: string }>;
  items: RoadmapItem[];
  milestones: Array<{
    stage: string;
    title: string;
    completionCriteria: string;
    itemIds: string[];
    completed: boolean;
  }>;
  progressPercent: number;
  sourceReportTitle: string;
  lastActivityAt: string;
  createdAt: string;
}

export interface CandidateDashboardData {
  candidate: {
    id: string;
    fullName: string;
    profileCompletion: number;
    batch: string | null;
    department: string | null;
  } | null;
  summary: {
    assessmentsCompleted: number;
    assessmentsInProgress: number;
    totalAssessmentsAttempted: number;
    reportsGenerated: number;
    roadmapsActive: number;
    skillsMeasured: number;
    averageObjectiveScore: number | null;
    catalogueCoverage: number;
  };
  categoryPerformance: Array<{ category: string; completed: number; averagePercentage: number }>;
  recentAttempts: Array<{
    id: string;
    assessmentTitle: string;
    category: string;
    status: string;
    percentage: number | null;
    submittedAt: string | null;
  }>;
  topSkills: Array<{ code: string; name: string; score: number }>;
  weakestMeasuredSkills: Array<{ code: string; name: string; score: number }>;
  preferenceProfile: Array<{ dimension: string; score: number; itemsAnswered: number }>;
  topRecommendations: Array<{
    careerId: string;
    slug: string;
    title: string;
    compatibilityScore: number;
    confidence: string;
  }>;
  latestReport: { id: string; generatedAt: string; scoringVersion: string } | null;
  roadmapProgress: Array<{ id: string; careerId: string; title: string; progressPercent: number }>;
  isEmpty: boolean;
}

export interface InstitutionAnalytics {
  scope: { batch: string | null; department: string | null };
  summary: {
    totalStudents: number;
    studentsWithProgress: number;
    studentsWithReports: number;
    totalCompletedAssessments: number;
    publishedAssessments: number;
    activeCareers: number;
    overallCompletionRate: number | null;
    overallAverageScore: number | null;
  };
  categoryPerformance: Array<{ category: string; completed: number; averagePercentage: number }>;
  batchDistribution: Array<{ batch: string; count: number }>;
  careerInterest: Array<{ career: string; count: number }>;
  privacyNotice: string;
  isEmpty: boolean;
}

export interface CounsellorAnalytics {
  scope: { counsellorId: string; batch: string | null; department: string | null };
  summary: {
    assignedStudents: number;
    studentsWithProgress: number;
    studentsWithoutAnyAssessment: number;
    completedAssessments: number;
    studentsWithReports: number;
    overallAverageScore: number | null;
  };
  categoryPerformance: Array<{ category: string; completed: number; averagePercentage: number }>;
  mostCommonTopCareer: Array<{ career: string; count: number }>;
  studentsNeedingAttention: Array<{ candidateId: string; completedAssessments: number }>;
  isEmpty: boolean;
}

export interface SystemAnalytics {
  summary: {
    totalUsers: number;
    activeUsers: number;
    totalQuestions: number;
    activeQuestions: number;
    totalAssessments: number;
    publishedAssessments: number;
    totalAttempts: number;
    completedAttempts: number;
    liveAttempts: number;
    totalReports: number;
    totalSkills: number;
    activeCareers: number;
    recentSecurityEvents: number;
  };
  usersByRole: Array<{ role: string; count: number }>;
  completionRate: number | null;
}

export interface Question {
  id: string;
  text: string;
  category: AssessmentCategory;
  topic: string;
  questionType: 'mcq' | 'likert';
  options: Array<{ optionId: string; text: string; preferencePoints?: number }>;
  correctOptionId: string | null;
  preferenceDimension: string | null;
  scaleMin: number | null;
  scaleMax: number | null;
  explanation: string | null;
  difficulty: 'easy' | 'medium' | 'hard';
  skillMappings: Array<{ skill: string; weight: number }>;
  marks: number;
  isActive: boolean;
  isSample: boolean;
  usageCount: number;
  scorable: boolean;
  createdAt?: string;
}

export interface Skill {
  _id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  isPreferenceSkill: boolean;
  measurementUnit: string;
  isActive: boolean;
  tags: string[];
  isSample: boolean;
}

export interface Career {
  _id: string;
  slug: string;
  title: string;
  category: string;
  description: string;
  responsibilities: string[];
  requiredSkills: Array<{
    skill: string;
    skillCode: string;
    skillName: string;
    requiredLevel: number;
    weight: number;
    importance: 'core' | 'supporting';
    developmentFocus: string;
  }>;
  aptitudeFit: Array<{ dimension: string; weight: number }>;
  preferenceFit: Array<{ dimension: string; weight: number }>;
  prerequisites: string[];
  learningStages: Array<{ stage: string; focus: string[] }>;
  relatedCareers: string[];
  suggestedProjects: string[];
  isActive: boolean;
  isSample: boolean;
  sourceNote: string;
}

export interface AuditLogEntry {
  id: string;
  actor: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  category: string;
  targetType: string | null;
  targetId: string | null;
  outcome: string;
  message: string;
  metadata: Record<string, unknown> | null;
  severity: 'info' | 'warning' | 'critical';
  createdAt: string;
}

export interface AiProviderStatus {
  selected: string;
  usable: boolean;
  activeProvider: string | null;
  reason: string;
  providers: Array<{ name: string; configured: boolean; model: string; reason: string | null }>;
  keysInEnvironment: { gemini: boolean; openai: boolean };
  note: string;
}
