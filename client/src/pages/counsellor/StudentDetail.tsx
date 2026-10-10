import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardList, FileText } from 'lucide-react';
import { api } from '../../lib/api';
import type { CandidateDashboardData, CareerReport, SkillMeasurement } from '../../types';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  LoadingBlock,
  ProgressBar,
  scoreColour,
} from '../../components/common';
import { categoryLabel, formatDateTime, statusLabel } from '../../lib/format';

interface AttemptSummary {
  id: string;
  assessmentTitle: string;
  category: string;
  status: string;
  percentage: number | null;
  submittedAt: string | null;
}

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<CandidateDashboardData | null>(null);
  const [skills, setSkills] = useState<SkillMeasurement[] | null>(null);
  const [reports, setReports] = useState<CareerReport[]>([]);
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [dashboard, skillProfile, reportList] = await Promise.all([
        api.get<CandidateDashboardData>('/analytics/candidates/' + id),
        api.get<{ empty: boolean; measurements: SkillMeasurement[] }>('/profile/skill-profile', {
          candidateId: id,
        }),
        api.get<{ reports: CareerReport[] }>('/supervisor/reports', { candidateId: id, limit: 10 }),
      ]);
      setProfile(dashboard.data);
      setSkills(skillProfile.data.empty ? [] : skillProfile.data.measurements);
      setReports(reportList.data.reports);
      setAttempts(dashboard.data.recentAttempts as AttemptSummary[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingBlock label="Loading candidate record" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/counsellor/students" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-navy-900">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to students
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-navy-900">
          {profile?.candidate?.fullName ?? 'Candidate record'}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {profile?.candidate?.batch ? `Batch ${profile.candidate.batch}` : 'No batch recorded'}
          {profile?.candidate?.department ? ` · ${profile.candidate.department}` : ''}
        </p>
      </div>

      {profile?.isEmpty && (
        <EmptyState
          icon={<ClipboardList className="h-8 w-8" aria-hidden="true" />}
          title="No assessment activity recorded"
          description="This candidate has not completed any assessment yet, so there is nothing to review."
        />
      )}

      {profile && !profile.isEmpty && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card title="Assessments completed">
              <p className="text-2xl font-bold text-navy-900">{profile.summary.assessmentsCompleted}</p>
              <p className="mt-1 text-xs text-slate-500">
                {profile.summary.skillsMeasured} skills measured
              </p>
            </Card>
            <Card title="Average objective score">
              <p className={`text-2xl font-bold ${profile.summary.averageObjectiveScore === null ? 'text-slate-400' : scoreColour(profile.summary.averageObjectiveScore)}`}>
                {profile.summary.averageObjectiveScore === null ? 'n/a' : `${profile.summary.averageObjectiveScore}%`}
              </p>
              <p className="mt-1 text-xs text-slate-500">Scored assessments only</p>
            </Card>
            <Card title="Profile completion">
              <p className="text-2xl font-bold text-navy-900">{profile.candidate?.profileCompletion ?? 0}%</p>
              <div className="mt-2">
                <ProgressBar value={profile.candidate?.profileCompletion ?? 0} showValue={false} />
              </div>
            </Card>
            <Card title="Career reports">
              <p className="text-2xl font-bold text-navy-900">{profile.summary.reportsGenerated}</p>
              <p className="mt-1 text-xs text-slate-500">{profile.summary.roadmapsActive} roadmaps active</p>
            </Card>
          </div>

          <Card title="Top career matches" description="From the candidate's most recent report">
            {profile.topRecommendations.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">No career report generated yet.</p>
            ) : (
              <ul className="space-y-3">
                {profile.topRecommendations.map((rec) => (
                  <li key={rec.slug}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-navy-900">{rec.title}</span>
                      <span className="flex items-center gap-2">
                        <span className={`font-semibold ${scoreColour(rec.compatibilityScore)}`}>
                          {rec.compatibilityScore}
                        </span>
                        <Badge tone="neutral">{rec.confidence}</Badge>
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <ProgressBar value={rec.compatibilityScore} showValue={false} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Skill profile" description="Measured competencies available for this candidate">
            {!skills || skills.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">No skills measured yet.</p>
            ) : (
              <ul className="space-y-3">
                {skills.slice(0, 15).map((skill) => (
                  <li key={skill.code}>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-navy-800">{skill.name}</span>
                      <span className={`shrink-0 font-medium tabular-nums ${scoreColour(skill.score)}`}>
                        {skill.score}
                      </span>
                    </div>
                    <div className="mt-1">
                      <ProgressBar value={skill.score} showValue={false} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Recent assessment activity">
            {attempts.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">No attempts recorded.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {attempts.map((attempt) => (
                  <li key={attempt.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-navy-900">{attempt.assessmentTitle}</p>
                      <p className="text-xs text-slate-500">
                        {categoryLabel(attempt.category)} &middot; {formatDateTime(attempt.submittedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {attempt.percentage !== null && (
                        <span className={`text-sm font-semibold ${scoreColour(attempt.percentage)}`}>
                          {attempt.percentage}%
                        </span>
                      )}
                      <Badge tone={attempt.status === 'in_progress' ? 'warning' : 'neutral'}>
                        {statusLabel(attempt.status)}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Career reports" description="Read-only access to reports of assigned candidates">
            {reports.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">No reports generated yet.</p>
            ) : (
              <ul className="space-y-2">
                {reports.map((report) => (
                  <li
                    key={report.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-navy-900">{report.reportNumber}</p>
                      <p className="text-xs text-slate-500">
                        {formatDateTime(report.generatedAt)} &middot; {report.recommendations.length} options &middot;{' '}
                        {report.aiProviderUsed === 'none' ? 'deterministic' : `AI: ${report.aiProviderUsed}`}
                      </p>
                    </div>
                    <a
                      href={`/api/v1/reports/${report.reportNumber}/download`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-secondary"
                    >
                      <FileText className="h-3.5 w-3.5" aria-hidden="true" /> Open printable report
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-slate-500">
              Reports are shown read-only. Generating a report on the candidate&rsquo;s behalf is done from their own
              account so that the report records the correct skill profile revision.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
