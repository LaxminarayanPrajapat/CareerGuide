import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BarChart3, ClipboardList, FileText, Users } from 'lucide-react';
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
import type { CounsellorAnalytics } from '../../types';
import { useAuth } from '../../features/auth/AuthContext';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  StatCard,
  Skeleton,
  scoreColour,
} from '../../components/common';
import { categoryLabel } from '../../lib/format';

const COLOURS = ['#2563eb', '#0d9488', '#7c3aed', '#ea580c', '#e11d48'];

export default function CounsellorDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<CounsellorAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: response } = await api.get<CounsellorAnalytics>('/analytics/counsellor');
      setData(response);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Skeleton className="h-96 w-full" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">
          Welcome, {user?.fullName.split(' ')[0]}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          An overview of the candidates assigned to you. Records outside your assignment are not accessible.
        </p>
      </header>

      {data.isEmpty && (
        <EmptyState
          icon={<Users className="h-8 w-8" aria-hidden="true" />}
          title="No students assigned to you yet"
          description="An administrator assigns candidates to counsellors. Once assigned, their progress appears here."
        />
      )}

      {data.summary.assignedStudents > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Assigned students"
              value={data.summary.assignedStudents}
              hint={`${data.summary.studentsWithProgress} have started`}
              icon={<Users className="h-4 w-4" aria-hidden="true" />}
            />
            <StatCard
              label="Not yet started"
              value={data.summary.studentsWithoutAnyAssessment}
              hint="No completed assessment on record"
              icon={<AlertTriangle className="h-4 w-4" aria-hidden="true" />}
              tone={data.summary.studentsWithoutAnyAssessment > 0 ? 'warning' : 'default'}
            />
            <StatCard
              label="Completed assessments"
              value={data.summary.completedAssessments}
              hint="Across all assigned students"
              icon={<ClipboardList className="h-4 w-4" aria-hidden="true" />}
            />
            <StatCard
              label="Average score"
              value={data.summary.overallAverageScore === null ? 'n/a' : `${data.summary.overallAverageScore}%`}
              hint="Objective assessments only"
              icon={<BarChart3 className="h-4 w-4" aria-hidden="true" />}
              tone="accent"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Performance by category" description="Average score across your assigned students">
              {data.categoryPerformance.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  No objective assessments completed yet.
                </p>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.categoryPerformance}
                      margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="category"
                        tickFormatter={(v: string) => categoryLabel(v)}
                        tick={{ fontSize: 11, fill: '#64748b' }}
                      />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} />
                      <Tooltip
                        formatter={(value: number) => [`${value}%`, 'Average']}
                        labelFormatter={(label) => categoryLabel(String(label))}
                        contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                      />
                      <Bar dataKey="averagePercentage" radius={[6, 6, 0, 0]} maxBarSize={56}>
                        {data.categoryPerformance.map((entry, index) => (
                          <Cell key={entry.category} fill={COLOURS[index % COLOURS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card
              title="Most common top career match"
              description="Aggregate across reports of your assigned students"
            >
              {data.mostCommonTopCareer.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  No career reports have been generated yet.
                </p>
              ) : (
                <ul className="space-y-3">
                  {data.mostCommonTopCareer.map((item) => {
                    const max = Math.max(...data.mostCommonTopCareer.map((c) => c.count));
                    return (
                      <li key={item.career}>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="truncate text-navy-800">{item.career}</span>
                          <span className="shrink-0 font-medium tabular-nums text-navy-900">{item.count}</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full rounded-full bg-slate-200">
                          <div
                            className="h-1.5 rounded-full bg-accent-500"
                            style={{ width: `${(item.count / max) * 100}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>

          <Card
            title="Students who may need guidance"
            description="Fewer than two completed assessments"
            actions={
              <Link to="/counsellor/students" className="btn btn-sm btn-secondary">
                View all students
              </Link>
            }
          >
            {data.studentsNeedingAttention.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">
                All assigned students have completed at least two assessments.
              </p>
            ) : (
              <ul className="space-y-2">
                {data.studentsNeedingAttention.map((entry) => (
                  <li key={entry.candidateId}>
                    <Link
                      to={`/counsellor/students/${entry.candidateId}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-2.5 hover:bg-slate-50"
                    >
                      <span className="text-sm text-navy-800">Candidate record</span>
                      <Badge tone="warning">{entry.completedAssessments} completed</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="flex flex-wrap gap-2">
              <Link to="/counsellor/students" className="btn btn-secondary">
                <Users className="h-4 w-4" aria-hidden="true" /> Assigned students
              </Link>
              <Link to="/counsellor/questions" className="btn btn-secondary">
                <ClipboardList className="h-4 w-4" aria-hidden="true" /> Question bank
              </Link>
              <Link to="/counsellor/assessments" className="btn btn-secondary">
                <FileText className="h-4 w-4" aria-hidden="true" /> Test sets
              </Link>
              <Link to="/counsellor/analytics" className="btn btn-secondary">
                <BarChart3 className="h-4 w-4" aria-hidden="true" /> Batch analytics
              </Link>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

export { scoreColour };
