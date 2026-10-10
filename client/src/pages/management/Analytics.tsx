import { useCallback, useEffect, useState } from 'react';
import { Download, Info } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api, downloadFile } from '../../lib/api';
import type { InstitutionAnalytics } from '../../types';
import { Card, EmptyState, ErrorState, Skeleton, StatCard } from '../../components/common';
import { FilterSelect } from '../../components/common/Pagination';
import { useToast } from '../../components/common/ToastProvider';
import { categoryLabel } from '../../lib/format';

interface TrendPoint {
  month: string;
  completed: number;
  averageScore: number | null;
}

export default function ManagementAnalytics() {
  const toast = useToast();
  const [data, setData] = useState<InstitutionAnalytics | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [groups, setGroups] = useState<{ batches: string[]; departments: string[] }>({ batches: [], departments: [] });
  const [batch, setBatch] = useState('');
  const [department, setDepartment] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [institution, trendResponse] = await Promise.all([
        api.get<InstitutionAnalytics>('/analytics/institution', {
          batch: batch || undefined,
          department: department || undefined,
        }),
        api.get<{ trend: TrendPoint[] }>('/analytics/trend', { months: 12, batch: batch || undefined }),
      ]);
      setData(institution.data);
      setTrend(trendResponse.data.trend);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [batch, department]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    api
      .get<{ batches: string[]; departments: string[] }>('/analytics/groups')
      .then(({ data }) => setGroups(data))
      .catch(() => setGroups({ batches: [], departments: [] }));
  }, []);

  async function exportCsv() {
    setExporting(true);
    try {
      await downloadFile('/exports/analytics.csv', 'institutional-analytics.csv');
      toast.success('Export downloaded.');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900">Aggregate analytics</h1>
          <p className="mt-1 text-sm text-slate-600">
            Completion, performance and interest trends across the selected population. No candidate-level data is
            returned by any endpoint on this screen.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={exportCsv} disabled={exporting}>
          <Download className="h-4 w-4" aria-hidden="true" />
          {exporting ? 'Preparing...' : 'Export CSV'}
        </button>
      </header>

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <FilterSelect
            label="Batch"
            value={batch}
            onChange={setBatch}
            options={[{ value: '', label: 'All batches' }, ...groups.batches.map((b) => ({ value: b, label: b }))]}
          />
          <FilterSelect
            label="Department"
            value={department}
            onChange={setDepartment}
            options={[
              { value: '', label: 'All departments' },
              ...groups.departments.map((d) => ({ value: d, label: d })),
            ]}
          />
        </div>
      </Card>

      {error && <ErrorState message={error} onRetry={load} />}
      {!data && !error && <Skeleton className="h-96 w-full" />}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Students" value={data.summary.totalStudents} />
            <StatCard
              label="Assessments completed"
              value={data.summary.totalCompletedAssessments}
              hint={`${data.summary.studentsWithReports} with a report`}
            />
            <StatCard
              label="Completion rate"
              value={data.summary.overallCompletionRate === null ? 'n/a' : `${data.summary.overallCompletionRate}%`}
              tone="accent"
            />
            <StatCard
              label="Average score"
              value={data.summary.overallAverageScore === null ? 'n/a' : `${data.summary.overallAverageScore}%`}
            />
          </div>

          <Card title="Monthly completion trend" description="Assessments completed per month">
            {trend.some((t) => t.completed > 0) ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      formatter={(value: number, name) => [value, name === 'completed' ? 'Completed' : 'Avg score']}
                      contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                    />
                    <Line type="monotone" dataKey="completed" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState title="No completion data in this period" description="Trend appears once assessments are completed." />
            )}
          </Card>

          <Card title="Average score by category">
            {data.categoryPerformance.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">No objective assessments completed yet.</p>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.categoryPerformance} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="category"
                      tickFormatter={(v: string) => categoryLabel(v)}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                    />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} />
                    <Tooltip
                      formatter={(value: number) => [`${value}%`, 'Average score']}
                      labelFormatter={(label) => categoryLabel(String(label))}
                      contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                    />
                    <Bar dataKey="averagePercentage" radius={[6, 6, 0, 0]} maxBarSize={56} fill="#0d9488" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card>
            <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {data.privacyNotice} Small cohort sizes are shown alongside every figure so results are not
              over-interpreted. These statistics describe activity in this system only and are not measures of
              teaching quality or student ability.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
