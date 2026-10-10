import { useCallback, useEffect, useState } from 'react';
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
import type { SystemAnalytics } from '../../types';
import { Card, ErrorState, ProgressBar, Skeleton, StatCard } from '../../components/common';
import { roleLabel } from '../../lib/format';

const COLOURS = ['#2563eb', '#0d9488', '#7c3aed', '#ea580c'];

export default function AdminAnalytics() {
  const [data, setData] = useState<SystemAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: response } = await api.get<SystemAnalytics>('/analytics/system');
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

  const totalRoleCount = data.usersByRole.reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">System analytics</h1>
        <p className="mt-1 text-sm text-slate-600">
          Platform-wide counts for monitoring. These are operational figures, not measures of learner ability.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Questions"
          value={data.summary.totalQuestions}
          hint={`${data.summary.activeQuestions} active / ${data.summary.totalQuestions - data.summary.activeQuestions} inactive`}
        />
        <StatCard label="Active skills" value={data.summary.totalSkills} />
        <StatCard label="Active careers" value={data.summary.activeCareers} />
        <StatCard
          label="Test sets"
          value={data.summary.totalAssessments}
          hint={`${data.summary.publishedAssessments} published`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Users by role">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.usersByRole} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="role"
                  tickFormatter={(v: string) => roleLabel(v)}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} />
                <Tooltip
                  formatter={(value: number) => [value, 'Users']}
                  labelFormatter={(label) => roleLabel(String(label))}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={56}>
                  {data.usersByRole.map((entry, index) => (
                    <Cell key={entry.role} fill={COLOURS[index % COLOURS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-4 space-y-3">
            {data.usersByRole.map((entry) => (
              <li key={entry.role}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-navy-800">{roleLabel(entry.role)}</span>
                  <span className="tabular-nums text-slate-600">{entry.count}</span>
                </div>
                <div className="mt-1">
                  <ProgressBar
                    value={totalRoleCount > 0 ? (entry.count / totalRoleCount) * 100 : 0}
                    showValue={false}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Attempt lifecycle">
          <ul className="space-y-4">
            {[
              { label: 'Total attempts', value: data.summary.totalAttempts, colour: 'bg-navy-700' },
              { label: 'Completed', value: data.summary.completedAttempts, colour: 'bg-emerald-500' },
              { label: 'Auto-submitted on expiry', value: null, colour: 'bg-amber-500' },
              { label: 'Currently in progress', value: data.summary.liveAttempts, colour: 'bg-accent-500' },
            ].map((row) => (
              <li key={row.label} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm text-navy-800">
                  <span className={`h-2.5 w-2.5 rounded-full ${row.colour}`} aria-hidden="true" />
                  {row.label}
                </span>
                <span className="text-sm font-semibold tabular-nums text-navy-900">
                  {row.value === null ? '-' : row.value}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-6 space-y-3 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-navy-800">Completion rate</span>
              <span className="text-sm font-semibold tabular-nums text-navy-900">
                {data.completionRate === null ? 'n/a' : `${data.completionRate}%`}
              </span>
            </div>
            <ProgressBar
              value={data.completionRate ?? 0}
              showValue={false}
              colourClass={data.completionRate !== null && data.completionRate > 80 ? 'bg-emerald-500' : 'bg-accent-500'}
            />
          </div>

          <p className="mt-4 text-xs leading-relaxed text-slate-500">
            An attempt that reaches its server deadline without a manual submission is finalised automatically by the
            maintenance sweep, so the completion rate reflects every recorded attempt rather than only those with a
            deliberate submit action.
          </p>
        </Card>
      </div>
    </div>
  );
}
