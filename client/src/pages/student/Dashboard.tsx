import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  FileText,
  Gauge,
  Sparkles,
  Target,
  TrendingUp,
  UserCog,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../../lib/api';
import type { CandidateDashboardData } from '../../types';
import { useAuth } from '../../features/auth/AuthContext';
import { useToast } from '../../components/common/ToastProvider';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  ProgressBar,
  StatCard,
  scoreBarColour,
} from '../../components/common';
import {
  categoryLabel,
  formatRelative,
  scoreColour,
  statusLabel,
} from '../../lib/format';

const CHART_COLOURS = ['#2563eb', '#0d9488', '#7c3aed', '#ea580c', '#e11d48'];

export default function StudentDashboard() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<CandidateDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<{ data: CandidateDashboardData }>('/analytics/self');
      setData(response.data.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function generateReport() {
    setGenerating(true);
    try {
      const { data } = await api.post<{ reportId: string; reused: boolean; ai: { available: boolean; providerUsed: string } }>(
        '/reports/generate',
        { includeRoadmaps: true, roadmapCount: 3 },
      );
      if (data.reused) toast.info('Your existing report is already up to date.');
      else toast.success(`Report ${data.reportId} generated.`);
      await load();
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900">
            Welcome back, {user?.fullName.split(' ')[0]}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Your skill profile is built only from assessments you complete here.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/assessments" className="btn btn-primary">
            <ClipboardList className="h-4 w-4" aria-hidden="true" /> Take an assessment
          </Link>
          <button type="button" className="btn btn-secondary" onClick={generateReport} disabled={generating}>
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {generating ? 'Generating...' : 'Generate career report'}
          </button>
        </div>
      </header>

      {error && <ErrorState message={error} onRetry={load} />}

      {data && data.isEmpty && (
        <EmptyState
          icon={<ClipboardList className="h-8 w-8" aria-hidden="true" />}
          title="No assessments completed yet"
          description="Your skill profile, compatibility scores and career report are all derived from real assessment results. Complete your first assessment to populate them."
          action={
            <Link to="/assessments" className="btn btn-primary">
              Browse available assessments
            </Link>
          }
        />
      )}

      {data && (
        <>
          {data.candidate && data.candidate.profileCompletion < 100 && (
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <UserCog className="h-4 w-4 text-accent-600" aria-hidden="true" />
                    <h2 className="text-sm font-semibold text-navy-900">Complete your profile</h2>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    Adding your academic details improves batch-level analytics and helps your counsellor support you.
                  </p>
                  <div className="mt-3 max-w-md">
                    <ProgressBar value={data.candidate.profileCompletion} label="Profile completion" />
                  </div>
                </div>
                <Link to="/profile" className="btn btn-secondary">
                  Update profile
                </Link>
              </div>
            </Card>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Assessments completed"
              value={data.summary.assessmentsCompleted}
              hint={
                data.summary.assessmentsInProgress > 0
                  ? `${data.summary.assessmentsInProgress} in progress`
                  : 'None in progress'
              }
              icon={<ClipboardList className="h-4 w-4" aria-hidden="true" />}
            />
            <StatCard
              label="Skills measured"
              value={data.summary.skillsMeasured}
              hint={`${Math.round(data.summary.catalogueCoverage * 100)}% catalogue coverage`}
              icon={<Target className="h-4 w-4" aria-hidden="true" />}
              tone="accent"
            />
            <StatCard
              label="Average objective score"
              value={data.summary.averageObjectiveScore === null ? 'n/a' : `${data.summary.averageObjectiveScore}%`}
              hint={
                data.summary.averageObjectiveScore === null
                  ? 'No scored assessments yet'
                  : 'Across completed scored tests'
              }
              icon={<Gauge className="h-4 w-4" aria-hidden="true" />}
            />
            <StatCard
              label="Career reports"
              value={data.summary.reportsGenerated}
              hint={data.latestReport ? `Latest ${formatRelative(data.latestReport.generatedAt)}` : 'None generated'}
              icon={<FileText className="h-4 w-4" aria-hidden="true" />}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card
              title="Top career recommendations"
              description="From your most recent report"
              className="lg:col-span-2"
              actions={
                <Link to="/reports" className="btn btn-sm btn-secondary">
                  View all reports
                </Link>
              }
            >
              {data.topRecommendations.length === 0 ? (
                <EmptyState
                  title="No recommendations yet"
                  description="Complete assessments and generate a career report to see ranked, evidence-based options."
                  action={
                    <button type="button" className="btn btn-sm btn-primary" onClick={generateReport} disabled={generating}>
                      {generating ? 'Generating...' : 'Generate report'}
                    </button>
                  }
                />
              ) : (
                <ul className="space-y-4">
                  {data.topRecommendations.map((rec) => (
                    <li key={rec.slug}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-navy-900">{rec.title}</p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {rec.confidence} confidence &middot; {Math.round(rec.compatibilityScore)} / 100 compatibility
                          </p>
                        </div>
                        <span className={`shrink-0 text-lg font-semibold ${scoreColour(rec.compatibilityScore)}`}>
                          {rec.compatibilityScore}
                        </span>
                      </div>
                      <div className="mt-2">
                        <ProgressBar
                          value={rec.compatibilityScore}
                          showValue={false}
                          colourClass={scoreBarColour(rec.compatibilityScore)}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card
              title="Strongest measured skills"
              actions={
                <Link to="/compatibility" className="btn btn-sm btn-secondary">
                  Skill profile
                </Link>
              }
            >
              {data.topSkills.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">No skills measured yet.</p>
              ) : (
                <ul className="space-y-3">
                  {data.topSkills.map((skill) => (
                    <li key={skill.code}>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate text-navy-800">{skill.name}</span>
                        <span className={`shrink-0 font-medium tabular-nums ${scoreColour(skill.score)}`}>
                          {skill.score}
                        </span>
                      </div>
                      <div className="mt-1">
                        <ProgressBar
                          value={skill.score}
                          showValue={false}
                          colourClass={scoreBarColour(skill.score)}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card
              title="Performance by category"
              description="Average score of completed objective assessments"
              className="lg:col-span-2"
            >
              {data.categoryPerformance.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">
                  Complete an objective assessment to see category performance.
                </p>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.categoryPerformance} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="category"
                        tickFormatter={(v: string) => categoryLabel(v)}
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        axisLine={{ stroke: '#e2e8f0' }}
                      />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} />
                      <Tooltip
                        formatter={(value: number) => [`${value}%`, 'Average score']}
                        labelFormatter={(label) => categoryLabel(String(label))}
                        contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                      />
                      <Bar dataKey="averagePercentage" radius={[6, 6, 0, 0]} maxBarSize={56}>
                        {data.categoryPerformance.map((entry, index) => (
                          <Cell key={entry.category} fill={CHART_COLOURS[index % CHART_COLOURS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card title="Roadmap progress" actions={<Link to="/roadmaps" className="btn btn-sm btn-secondary">View</Link>}>
              {data.roadmapProgress.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">
                  Generate a report to receive personalised learning roadmaps.
                </p>
              ) : (
                <ul className="space-y-4">
                  {data.roadmapProgress.map((roadmap) => (
                    <li key={roadmap.id}>
                      <Link to={`/roadmaps/${roadmap.id}`} className="text-sm font-medium text-navy-900 hover:underline">
                        {roadmap.title}
                      </Link>
                      <div className="mt-1.5">
                        <ProgressBar value={roadmap.progressPercent} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card
              title="Recent assessment activity"
              actions={
                <Link to="/history" className="btn btn-sm btn-secondary">
                  Full history
                </Link>
              }
            >
              {data.recentAttempts.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">No attempts yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.recentAttempts.map((attempt) => (
                    <li key={attempt.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-navy-900">{attempt.assessmentTitle}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {categoryLabel(attempt.category)} &middot; {formatRelative(attempt.submittedAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {attempt.percentage !== null ? (
                          <span className={`text-sm font-semibold ${scoreColour(attempt.percentage)}`}>
                            {attempt.percentage}%
                          </span>
                        ) : (
                          <Badge tone="info">Preferences</Badge>
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

            <Card title="Next steps">
              <ul className="space-y-3">
                <NextStep
                  done={data.summary.assessmentsCompleted > 0}
                  title="Complete your first assessment"
                  body="Start with aptitude or working preferences - both feed directly into your recommendations."
                  to="/assessments"
                  icon={<ClipboardList className="h-4 w-4" aria-hidden="true" />}
                />
                <NextStep
                  done={data.summary.skillsMeasured >= 10}
                  title="Broaden your coverage"
                  body={`${data.summary.skillsMeasured} skills measured so far. Technical and domain assessments add the evidence careers are matched against.`}
                  to="/assessments"
                  icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />}
                />
                <NextStep
                  done={data.summary.reportsGenerated > 0}
                  title="Generate your career report"
                  body="Produces ranked career options with evidence, gaps and a personalised roadmap."
                  to="/reports"
                  icon={<FileText className="h-4 w-4" aria-hidden="true" />}
                />
                <NextStep
                  done={data.summary.roadmapsActive > 0 && data.roadmapProgress.some((r) => r.progressPercent > 0)}
                  title="Work through your roadmap"
                  body="Track each learning item so your progress is recorded against your target career."
                  to="/roadmaps"
                  icon={<BookOpen className="h-4 w-4" aria-hidden="true" />}
                />
                <NextStep
                  done={data.candidate?.profileCompletion === 100}
                  title="Finish your profile"
                  body="Academic details enable batch analytics and better counsellor support."
                  to="/profile"
                  icon={<BarChart3 className="h-4 w-4" aria-hidden="true" />}
                />
              </ul>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function NextStep({
  done,
  title,
  body,
  to,
  icon,
}: {
  done: boolean;
  title: string;
  body: string;
  to: string;
  icon: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
        }`}
        aria-hidden="true"
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${done ? 'text-slate-500 line-through' : 'text-navy-900'}`}>{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{body}</p>
        {!done && (
          <Link to={to} className="mt-1 inline-block text-xs font-medium text-accent-700 hover:underline">
            Go now
          </Link>
        )}
      </div>
    </li>
  );
}
