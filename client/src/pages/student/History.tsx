import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, TrendingUp } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../../lib/api';
import { Card, EmptyState, ErrorState, Badge, Skeleton, scoreColour } from '../../components/common';
import { Pagination } from '../../components/common/Pagination';
import { categoryLabel, formatDateTime, formatDuration, statusLabel } from '../../lib/format';

interface HistoryAttempt {
  id: string;
  assessmentId: string;
  assessmentTitle: string;
  category: string;
  scoringModel: string;
  status: string;
  submissionReason: string | null;
  percentage: number | null;
  passed: boolean | null;
  marksObtained: number | null;
  totalMarks: number | null;
  answeredCount: number;
  totalQuestions: number;
  timeSpentSeconds: number;
  submittedAt: string | null;
}

interface TrendPoint {
  month: string;
  completed: number;
  averageScore: number | null;
}

export default function HistoryPage() {
  const [attempts, setAttempts] = useState<HistoryAttempt[] | null>(null);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0, limit: 10 });
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [trend, setTrend] = useState<TrendPoint[] | null>(null);
  const [progression, setProgression] = useState<{
    empty: boolean;
    note?: string;
    multiObservationSkills: number;
    skills: Array<{
      skillCode: string;
      skillName: string;
      currentScore: number;
      observations: number;
      history: Array<{ assessmentTitle: string; score: number; at: string }>;
    }>;
  } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data, meta: responseMeta } = await api.get<{ attempts: HistoryAttempt[] }>('/attempts/history', {
        page,
        limit: 10,
      });
      setAttempts(data.attempts);
      if (responseMeta) setMeta(responseMeta as never);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    api
      .get<{ trend: TrendPoint[] }>('/analytics/trend', { months: 8 })
      .then(({ data }) => setTrend(data.trend))
      .catch(() => setTrend(null));

    api
      .get<never>('/analytics/progression')
      .then(({ data }) => setProgression(data as never))
      .catch(() => setProgression(null));
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">Assessment history</h1>
        <p className="mt-1 text-sm text-slate-600">
          Every completed attempt is kept. New assessments never overwrite previous results.
        </p>
      </header>

      {error && <ErrorState message={error} onRetry={load} />}

      {!attempts && !error && <Skeleton className="h-64 w-full" />}

      {attempts && attempts.length === 0 && (
        <EmptyState
          icon={<ClipboardList className="h-8 w-8" aria-hidden="true" />}
          title="No completed assessments yet"
          description="Your attempt history appears here once you complete your first test."
          action={
            <Link to="/assessments" className="btn btn-primary">
              Browse assessments
            </Link>
          }
        />
      )}

      {attempts && attempts.length > 0 && (
        <>
          <Card
            title="Recent objective scores"
            description="Trend of your completed scored assessments"
          >
            {attempts.filter((a) => a.percentage !== null).length < 2 ? (
              <p className="py-6 text-center text-sm text-slate-500">
                Complete at least two scored assessments to see a trend.
              </p>
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[...attempts]
                      .filter((a) => a.percentage !== null)
                      .reverse()
                      .map((a) => ({ label: a.assessmentTitle.slice(0, 18), score: a.percentage ?? 0 }))}
                    margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} interval={0} angle={-20} textAnchor="end" height={56} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} />
                    <Tooltip
                      formatter={(value: number) => [`${value}%`, 'Score']}
                      contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                    />
                    <Bar dataKey="score" radius={[6, 6, 0, 0]} maxBarSize={48}>
                      {[...attempts]
                        .filter((a) => a.percentage !== null)
                        .reverse()
                        .map((a, i) => (
                          <Cell
                            key={a.id}
                            fill={a.passed ? '#10b981' : a.passed === false ? '#f97316' : '#94a3b8'}
                          />
                        ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card bodyClassName="p-0">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Assessment</th>
                    <th>Category</th>
                    <th>Score</th>
                    <th>Answered</th>
                    <th>Time</th>
                    <th>Submitted</th>
                    <th>Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((attempt) => (
                    <tr key={attempt.id}>
                      <td className="font-medium text-navy-900">{attempt.assessmentTitle}</td>
                      <td className="whitespace-nowrap">
                        <Badge tone={attempt.scoringModel === 'preference' ? 'warning' : 'info'}>
                          {categoryLabel(attempt.category)}
                        </Badge>
                      </td>
                      <td>
                        {attempt.percentage === null ? (
                          <span className="text-xs text-slate-500">Preference profile</span>
                        ) : (
                          <span className={`font-semibold ${scoreColour(attempt.percentage)}`}>
                            {attempt.percentage}%
                            <span className="ml-1 text-xs font-normal text-slate-500">
                              ({attempt.marksObtained}/{attempt.totalMarks})
                            </span>
                          </span>
                        )}
                      </td>
                      <td className="tabular-nums">
                        {attempt.answeredCount}/{attempt.totalQuestions}
                      </td>
                      <td className="whitespace-nowrap text-xs text-slate-600">
                        {formatDuration(attempt.timeSpentSeconds)}
                      </td>
                      <td className="whitespace-nowrap text-xs text-slate-600">
                        {formatDateTime(attempt.submittedAt)}
                      </td>
                      <td>
                        <div className="flex flex-col gap-1">
                          <Badge
                            tone={
                              attempt.status === 'submitted'
                                ? 'success'
                                : attempt.status === 'auto_submitted'
                                  ? 'warning'
                                  : 'neutral'
                            }
                          >
                            {statusLabel(attempt.status)}
                          </Badge>
                          {attempt.passed === false && <Badge tone="danger">Below threshold</Badge>}
                        </div>
                      </td>
                      <td className="text-right">
                        <Link to={`/assessments/result/${attempt.id}`} className="btn btn-sm btn-secondary">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              total={meta.total}
              limit={meta.limit}
              onPageChange={setPage}
              label="attempts"
            />
          </Card>
        </>
      )}

      {progression && !progression.empty && (
        <Card
          title="Skill progression"
          description="Only skills with more than one observation can show a trend"
          actions={
            <Link to="/compatibility" className="btn btn-sm btn-secondary">
              Full skill profile
            </Link>
          }
        >
          {progression.note && <p className="mb-4 text-sm text-slate-500">{progression.note}</p>}
          {progression.multiObservationSkills === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">
              No skill has been measured more than once yet, so no progression can be shown.
            </p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={progression.skills
                    .filter((s) => s.history.length > 1)
                    .slice(0, 8)
                    .map((s) => ({
                      name: s.skillName,
                      ...Object.fromEntries(s.history.map((h, i) => [`t${i}`, h.score])),
                    }))}
                  margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  {progression.skills
                    .filter((s) => s.history.length > 1)
                    .slice(0, 8)
                    .map((s, i) => (
                      <Line
                        key={s.skillCode}
                        type="monotone"
                        dataKey={`t${s.history.length - 1}`}
                        name={s.skillName}
                        stroke={['#2563eb', '#0d9488', '#7c3aed', '#ea580c', '#e11d48', '#65a30d', '#0891b2', '#c026d3'][i % 8]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      )}

      {trend && trend.some((t) => t.completed > 0) && (
        <Card title="System usage" description="Assessments you completed per month">
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} />
                <Tooltip
                  formatter={(value: number, name) => [value, name === 'completed' ? 'Completed' : 'Average score']}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                />
                <Bar dataKey="completed" fill="#0d9488" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500">
        <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Progress across assessments is shown for your own history only. It is not compared against other candidates,
        and no percentile or ranking is produced.
      </p>
    </div>
  );
}
