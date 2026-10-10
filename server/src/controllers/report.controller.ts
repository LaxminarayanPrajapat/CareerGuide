import type { Request, Response } from 'express';
import { CareerReportModel } from '../models/CareerReport.js';
import { RoadmapModel } from '../models/Roadmap.js';
import { UserModel } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, paginationMeta } from '../utils/response.js';
import { escapeRegExp } from '../utils/pagination.js';
import { recordAudit, auditFromRequest } from '../services/audit/auditService.js';
import { generateCareerReport } from '../services/recommendations/recommendationService.js';
import { getProviderStatus } from '../services/ai/aiProviderRegistry.js';
import type { GenerateReportInput } from '../schemas/career.schema.js';

/**
 * Resolves the candidate a request is allowed to act on.
 * A candidate may only ever generate for themselves.
 */
async function resolveTargetCandidate(req: Request): Promise<string> {
  const requested = (req.body as GenerateReportInput).candidateId;
  if (!requested) return req.user!.id;

  if (String(requested) === req.user!.id) return req.user!.id;
  if (req.user!.permissions.includes('reports:read-assigned')) {
    const target = await UserModel.findById(requested).select('role assignedCounsellor');
    if (!target) throw ApiError.notFound('Candidate not found.');
    if (target.role !== 'student') throw ApiError.badRequest('Reports can only be generated for candidates.');
    if (req.user!.role === 'counsellor') {
      if (!target.assignedCounsellor || String(target.assignedCounsellor) !== req.user!.id) {
        throw ApiError.forbidden('This candidate is not assigned to you.');
      }
    }
    return String(requested);
  }
  throw ApiError.forbidden('You may only generate reports for your own profile.');
}

export const generateReport = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as GenerateReportInput;
  const candidateId = await resolveTargetCandidate(req);

  const result = await generateCareerReport({
    candidateId,
    generatedBy: req.user!.id,
    includeRoadmaps: body.includeRoadmaps,
    roadmapCount: body.roadmapCount,
    forceRegenerate: body.forceRegenerate,
  });

  await recordAudit(
    auditFromRequest(req, {
      action: 'report.generate',
      category: 'report',
      targetType: 'CareerReport',
      targetId: result.reportId,
      message: result.reused
        ? 'Reused the existing up-to-date career report.'
        : `Generated career report ${result.reportId} using ${result.aiProviderUsed} for narrative generation.`,
      metadata: { reportId: result.reportId, candidateId, aiProvider: result.aiProviderUsed, count: result.recommendations.length },
      severity: result.aiAvailable ? 'info' : 'info',
    }),
  );

  const status = getProviderStatus();
  return ok(
    res,
    {
      reportId: result.reportId,
      reused: result.reused,
      scoringVersion: 'compatibility-v1.0.0',
      ai: {
        available: result.aiAvailable,
        providerUsed: result.aiProviderUsed,
        failureReason: result.aiFailureReason ?? null,
        message: status.reason,
      },
      completedAssessments: result.completedAssessments,
      dataCoverage: result.dataCoverage,
      recommendations: result.recommendations,
      roadmapIds: result.roadmapIds,
    },
    result.reused ? 'An up-to-date report already exists.' : 'Career report generated.',
  );
});

function serialiseReport(report: {
  _id: unknown;
  reportNumber: string;
  candidate: unknown;
  scoringVersion: string;
  generatedAt: Date;
  skillProfileRevision: number;
  dataCoverage: number;
  completedAssessments: number;
  skillSnapshot: unknown[];
  strongestSkills: unknown[];
  weakestSkills: unknown[];
  unmeasuredSkillCodes: string[];
  recommendations: unknown[];
  preferenceProfile: unknown[];
  aiNarrative?: unknown;
  generationStatus: string;
  aiProviderUsed: string;
  aiFailureReason?: string;
  inputAssessments: unknown[];
  disclaimer: string;
}) {
  return {
    id: String(report._id),
    reportNumber: report.reportNumber,
    candidateId: String(report.candidate),
    scoringVersion: report.scoringVersion,
    generatedAt: report.generatedAt,
    skillProfileRevision: report.skillProfileRevision,
    dataCoverage: report.dataCoverage,
    completedAssessments: report.completedAssessments,
    skillSnapshot: report.skillSnapshot,
    strongestSkills: report.strongestSkills,
    weakestSkills: report.weakestSkills,
    unmeasuredSkillCodes: report.unmeasuredSkillCodes,
    recommendations: report.recommendations,
    preferenceProfile: report.preferenceProfile,
    aiNarrative: report.aiNarrative ?? null,
    generationStatus: report.generationStatus,
    aiProviderUsed: report.aiProviderUsed,
    aiFailureReason: report.aiFailureReason ?? null,
    inputAssessments: report.inputAssessments,
    disclaimer: report.disclaimer,
  };
}

export const listReports = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as { page: number; limit: number; candidateId?: string };
  const filter: Record<string, unknown> = {};

  if (query.candidateId && query.candidateId !== req.user!.id) {
    if (!req.user!.permissions.includes('reports:read-assigned')) {
      throw ApiError.forbidden('You may only view your own reports.');
    }
    if (req.user!.role === 'counsellor') {
      const target = await UserModel.findById(query.candidateId).select('role assignedCounsellor');
      if (!target) throw ApiError.notFound('Candidate not found.');
      if (!target.assignedCounsellor || String(target.assignedCounsellor) !== req.user!.id) {
        throw ApiError.forbidden('This candidate is not assigned to you.');
      }
    }
    filter.candidate = query.candidateId;
  } else {
    filter.candidate = query.candidateId ?? req.user!.id;
  }

  const [items, total] = await Promise.all([
    CareerReportModel.find(filter).sort({ generatedAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
    CareerReportModel.countDocuments(filter),
  ]);

  return ok(
    res,
    { reports: items.map((r) => serialiseReport(r as never)) },
    'Career reports.',
    paginationMeta(query.page, query.limit, total),
  );
});

export const getReport = asyncHandler(async (req: Request, res: Response) => {
  const report = await CareerReportModel.findOne({ reportNumber: req.params.id }).lean();
  if (!report) throw ApiError.notFound('Report not found.');

  const owner = String(report.candidate);
  if (owner !== req.user!.id) {
    if (!req.user!.permissions.includes('reports:read-assigned')) {
      throw ApiError.forbidden('You may only view your own reports.');
    }
    if (req.user!.role === 'counsellor') {
      const target = await UserModel.findById(owner).select('assignedCounsellor role');
      if (!target || !target.assignedCounsellor || String(target.assignedCounsellor) !== req.user!.id) {
        throw ApiError.forbidden('This candidate is not assigned to you.');
      }
    }
  }

  await recordAudit(
    auditFromRequest(req, {
      action: 'report.view',
      category: 'report',
      targetType: 'CareerReport',
      targetId: report.reportNumber,
      message: `Viewed career report ${report.reportNumber}.`,
      metadata: { reportId: report.reportNumber, candidateId: owner },
    }),
  );

  const candidate = await UserModel.findById(owner).select('fullName email studentProfile');
  return ok(res, { report: serialiseReport(report as never), candidate }, 'Career report.');
});

/**
 * Print / download view. Returns a self-contained HTML document so the browser
 * can print or save it as PDF, and access control is identical to GET /reports/:id.
 */
export const downloadReport = asyncHandler(async (req: Request, res: Response) => {
  const report = await CareerReportModel.findOne({ reportNumber: req.params.id }).lean();
  if (!report) throw ApiError.notFound('Report not found.');

  const owner = String(report.candidate);
  if (owner !== req.user!.id) {
    if (!req.user!.permissions.includes('reports:read-assigned')) {
      throw ApiError.forbidden('You may only download your own reports.');
    }
    if (req.user!.role === 'counsellor') {
      const target = await UserModel.findById(owner).select('assignedCounsellor');
      if (!target || !target.assignedCounsellor || String(target.assignedCounsellor) !== req.user!.id) {
        throw ApiError.forbidden('This candidate is not assigned to you.');
      }
    }
  }

  const candidate = await UserModel.findById(owner).select('fullName email studentProfile');
  const html = renderReportHtml(report as never, candidate as never);

  await recordAudit(
    auditFromRequest(req, {
      action: 'report.download',
      category: 'report',
      targetType: 'CareerReport',
      targetId: report.reportNumber,
      message: `Downloaded career report ${report.reportNumber}.`,
      metadata: { reportId: report.reportNumber, candidateId: owner },
    }),
  );

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${report.reportNumber}.html"`,
  );
  return res.send(html);
});

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderReportHtml(
  report: {
    reportNumber: string;
    generatedAt: Date;
    scoringVersion: string;
    completedAssessments: number;
    dataCoverage: number;
    skillSnapshot: Array<{ skillCode: string; skillName: string; score: number; evidence: number }>;
    strongestSkills: Array<{ skillName: string; score: number }>;
    weakestSkills: Array<{ skillName: string; score: number }>;
    unmeasuredSkillCodes: string[];
    recommendations: Array<{
      careerTitle: string;
      careerCategory: string;
      compatibilityScore: number;
      confidence: string;
      deterministicSummary: string;
      aiExplanation?: string;
      topGaps: Array<{ skillName: string; gap: number; priority: string }>;
    }>;
    preferenceProfile: Array<{ dimension: string; score: number; itemsAnswered: number }>;
    aiNarrative?: { overview?: string; strengths?: string[]; developmentAreas?: string[] };
    disclaimer: string;
    inputAssessments: Array<{ title: string; category: string; percentage: number }>;
  },
  candidate: { fullName: string; email: string; studentProfile?: Record<string, unknown> } | null,
): string {  const narrative = report.aiNarrative;
  const rows = report.recommendations
    .map(
      (r, index) => `
      <section class="card">
        <h3>${index + 1}. ${escapeHtml(r.careerTitle)} <span class="badge">${escapeHtml(r.careerCategory)}</span></h3>
        <p class="score">Career compatibility score: <strong>${r.compatibilityScore} / 100</strong>
           <span class="badge">${escapeHtml(r.confidence)} confidence</span></p>
        <p>${escapeHtml(r.deterministicSummary)}</p>
        ${r.aiExplanation ? `<p class="ai"><strong>AI explanation:</strong> ${escapeHtml(r.aiExplanation)}</p>` : ''}
        ${
          r.topGaps.length > 0
            ? `<h4>Priority gaps</h4><ul>${r.topGaps
                .map((g) => `<li>${escapeHtml(g.skillName)} - about ${Math.round(g.gap)} points below requirement (${escapeHtml(g.priority)} priority)</li>`)
                .join('')}</ul>`
            : '<p>No significant gaps were detected against the requirements that were measured.</p>'
        }
      </section>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Career Report ${escapeHtml(report.reportNumber)}</title>
<style>
  :root { color-scheme: light; }
  body { font-family: "Segoe UI", system-ui, -apple-system, sans-serif; color:#0f172a; background:#f8fafc; margin:0; padding:32px; line-height:1.55; }
  .page { max-width: 900px; margin: 0 auto; background:#fff; padding:40px; border-radius:12px; box-shadow:0 1px 3px rgba(15,23,42,.12); }
  header { border-bottom:3px solid #1d4ed8; padding-bottom:18px; margin-bottom:24px; }
  h1 { margin:0 0 6px; font-size:26px; }
  h2 { font-size:18px; margin-top:32px; color:#1e3a8a; border-bottom:1px solid #e2e8f0; padding-bottom:6px; }
  h3 { font-size:15px; margin:0 0 6px; }
  h4 { font-size:13px; margin:14px 0 4px; color:#334155; }
  .muted { color:#64748b; font-size:13px; }
  .badge { display:inline-block; background:#e0e7ff; color:#3730a3; border-radius:999px; padding:2px 10px; font-size:11px; margin-left:8px; vertical-align:middle; }
  .score strong { color:#1d4ed8; }
  .card { border:1px solid #e2e8f0; border-radius:10px; padding:16px 18px; margin-bottom:16px; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th, td { text-align:left; padding:7px 8px; border-bottom:1px solid #e2e8f0; }
  th { color:#475569; font-weight:600; background:#f1f5f9; }
  .bar { height:8px; background:#e2e8f0; border-radius:999px; overflow:hidden; }
  .bar > span { display:block; height:100%; background:#2563eb; }
  .disclaimer { margin-top:32px; padding:16px; background:#fffbeb; border:1px solid #fde68a; border-radius:10px; font-size:12px; color:#78350f; }
  ul { margin:6px 0 0 18px; padding:0; font-size:13px; }
  li { margin-bottom:4px; }
  .ai { background:#f0fdfa; border-left:3px solid #14b8a6; padding:8px 12px; }
  footer { margin-top:28px; border-top:1px solid #e2e8f0; padding-top:12px; font-size:11px; color:#94a3b8; }
  @media print { body { background:#fff; padding:0; } .page { box-shadow:none; border-radius:0; } }
</style>
</head>
<body>
<div class="page">
  <header>
    <h1>AI Career Path &amp; Skill Recommendation Report</h1>
    <p class="muted">Report ${escapeHtml(report.reportNumber)} &middot; generated ${escapeHtml(new Date(report.generatedAt).toUTCString())} &middot; scoring version ${escapeHtml(report.scoringVersion)}</p>
  </header>

  <div class="grid">
    <div>
      <h2>Candidate</h2>
      <table>
        <tr><th>Name</th><td>${escapeHtml(candidate?.fullName)}</td></tr>
        <tr><th>Email</th><td>${escapeHtml(candidate?.email)}</td></tr>
        <tr><th>Institution</th><td>${escapeHtml((candidate?.studentProfile as Record<string, unknown>)?.institution ?? '-')}</td></tr>
        <tr><th>Department</th><td>${escapeHtml((candidate?.studentProfile as Record<string, unknown>)?.department ?? '-')}</td></tr>
        <tr><th>Batch</th><td>${escapeHtml((candidate?.studentProfile as Record<string, unknown>)?.batch ?? '-')}</td></tr>
      </table>
    </div>
    <div>
      <h2>Assessment summary</h2>
      <table>
        <tr><th>Completed assessments</th><td>${report.completedAssessments}</td></tr>
        <tr><th>Skill catalogue coverage</th><td>${Math.round(report.dataCoverage * 100)}%</td></tr>
        <tr><th>Skills measured</th><td>${report.skillSnapshot.length}</td></tr>
      </table>
    </div>
  </div>

  ${
    report.inputAssessments.length > 0
      ? `<h2>Assessments used</h2>
      <table><tr><th>Assessment</th><th>Category</th><th>Score</th></tr>${report.inputAssessments
        .map(
          (a) =>
            `<tr><td>${escapeHtml(a.title)}</td><td>${escapeHtml(a.category)}</td><td>${
              a.category === 'personality' ? 'preference profile' : `${a.percentage}%`
            }</td></tr>`,
        )
        .join('')}</table>`
      : ''
  }

  <h2>Overall skill profile</h2>
  <table>
    <tr><th>Skill</th><th>Code</th><th>Measured level</th><th>Evidence</th><th></th></tr>
    ${report.skillSnapshot
      .map(
        (s) =>
          `<tr><td>${escapeHtml(s.skillName)}</td><td>${escapeHtml(s.skillCode)}</td><td>${s.score}</td><td>${s.evidence}</td><td class="barwrap" style="width:160px"><div class="bar"><span style="width:${Math.max(2, Math.min(100, s.score))}%"></span></div></td></tr>`,
      )
      .join('')}
  </table>
  ${
    report.unmeasuredSkillCodes.length > 0
      ? `<p class="muted">Not yet measured: ${report.unmeasuredSkillCodes.map(escapeHtml).join(', ')}. These are reported as unknown, not as weaknesses.</p>`
      : ''
  }

  <div class="grid">
    <div>
      <h2>Strongest demonstrated skills</h2>
      <ul>${report.strongestSkills.map((s) => `<li>${escapeHtml(s.skillName)} - ${s.score}</li>`).join('') || '<li>No skills measured yet.</li>'}</ul>
    </div>
    <div>
      <h2>Lowest measured skills</h2>
      <ul>${report.weakestSkills.map((s) => `<li>${escapeHtml(s.skillName)} - ${s.score}</li>`).join('') || '<li>No skills measured yet.</li>'}</ul>
    </div>
  </div>

  ${
    report.preferenceProfile.length > 0
      ? `<h2>Indicative working preferences</h2>
      <table><tr><th>Dimension</th><th>Preference score</th><th>Items answered</th></tr>${report.preferenceProfile
        .map((p) => `<tr><td>${escapeHtml(p.dimension)}</td><td>${p.score}</td><td>${p.itemsAnswered}</td></tr>`)
        .join('')}</table>
      <p class="muted">Preference scores indicate working style preferences only. They are not personality types, abilities or diagnoses.</p>`
      : ''
  }

  ${
    narrative?.overview
      ? `<h2>Summary</h2><p>${escapeHtml(narrative.overview)}</p>
         ${narrative.strengths?.length ? `<h4>Strengths highlighted</h4><ul>${narrative.strengths.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>` : ''}
         ${narrative.developmentAreas?.length ? `<h4>Development areas highlighted</h4><ul>${narrative.developmentAreas.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>` : ''}`
      : ''
  }

  <h2>Recommended career options</h2>
  ${rows || '<p>No recommendations were produced. Complete more assessments to enable matching.</p>'}

  <div class="disclaimer">
    <strong>Important limitations.</strong> ${escapeHtml(report.disclaimer)}
  </div>

  <footer>
    Generated by the AI Career Path &amp; Skill Recommendation System. Compatibility scores are computed by a
    deterministic algorithm (${escapeHtml(report.scoringVersion)}) and are not statistical predictions of career success.
  </footer>
</div>
</body>
</html>`;
}
