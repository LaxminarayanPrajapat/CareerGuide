import { useCallback, useEffect, useState } from 'react';
import { Building2, Download, Info, Users } from 'lucide-react';
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
import { api, downloadFile } from '../../lib/api';
import type { InstitutionAnalytics } from '../../types';
import { Badge, Card, EmptyState, ErrorState, Skeleton, StatCard } from '../../components/common';
import { FilterSelect } from '../../components/common/Pagination';
import { useToast } from '../../components/common/ToastProvider';
import { categoryLabel } from '../../lib/format';

const COLOURS = ['#2563eb', '#0d9488', '#7c3aed', '#ea580c', '#e11d48'];

export default function ManagementDashboard() {
  const toast = useToast();
  const [data, setData] = useState<InstitutionAnalytics | null>(null);
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
      const { data: response } = await api.get<InstitutionAnalytics>('/analytics/institution', {
        batch: batch || undefined,
        department: department || undefined,
      });
      setData(response);
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
      toast.success('Aggregate export downloaded.');
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
          <h1 className="text-2xl font-bold tracking-tight text-navy-900">Institutional dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">
            Aggregate system usage. The management role is read-only and never exposes individual candidate records.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={exportCsv} disabled={exporting}>
          <Download className="h-4 w-4" aria-hidden="true" />
          {exporting ? 'Preparing...' : 'Export aggregates'}
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
          {(batch || department) && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setBatch('');
                setDepartment('');
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      </Card>

      {error && <ErrorState message={error} onRetry={load} />}
      {!data && !error && <Skeleton className="h-96 w-full" />}

      {data && data.isEmpty && (
        <EmptyState
          icon={<Building2 className="h-8 w-8" aria-hidden="true" />}
          title="No candidates registered for this selection"
          description="Adjust the filters, or wait for candidates to register and complete assessments."
        />
      )}

      {data && !data.isEmpty && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Registered students"
              value={data.summary.totalStudents}
              hint={`${data.summary.studentsWithProgress} started assessing`}
              icon={<Users className="h-4 w-4" aria-hidden="true" />}
            />
            <StatCard
              label="Completion rate"
              value={data.summary.overallCompletionRate === null ? 'n/a' : `${data.summary.overallCompletionRate}%`}
              hint="Completed attempts vs published assessments"
              tone="accent"
            />
            <StatCard
              label="Average score"
              value={data.summary.overallAverageScore === null ? 'n/a' : `${data.summary.overallAverageScore}%`}
              hint="Objective assessments only"
            />
            <StatCard
              label="Career definitions"
              value={data.summary.activeCareers}
              hint={`${data.summary.publishedAssessments} published test sets`}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Assessment completion by category">
              {data.categoryPerformance.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">No completed assessments yet.</p>
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
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                        labelFormatter={(label) => categoryLabel(String(label))}
                      />
                      <Bar dataKey="completed" radius={[6, 6, 0, 0]} maxBarSize={56}>
                        {data.categoryPerformance.map((entry, index) => (
                          <Cell key={entry.category} fill={COLOURS[index % COLOURS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card title="Batch distribution">
              {data.batchDistribution.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">No batch information recorded yet.</p>
              ) : (
                <ul className="space-y-3">
                  {data.batchDistribution.map((item) => {
                    const max = Math.max(...data.batchDistribution.map((b) => b.count));
                    return (
                      <li key={item.batch}>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="truncate text-navy-800">{item.batch}</span>
                          <span className="shrink-0 font-medium tabular-nums text-navy-900">{item.count}</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full rounded-full bg-slate-200">
                          <div
                            className="h-1.5 rounded-full bg-navy-700"
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

          <Card title="Career-interest distribution" description="Top match recorded in each candidate's report">
            {data.careerInterest.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                No career reports have been generated yet, so there is no interest data to summarise.
              </p>
            ) : (
              <ul className="space-y-3">
                {data.careerInterest.map((item) => {
                  const max = Math.max(...data.careerInterest.map((c) => c.count));
                  return (
                    <li key={item.career}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate text-navy-800">{item.career}</span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="font-medium tabular-nums text-navy-900">{item.count}</span>
                          <Badge tone="neutral">
                            {Math.round((item.count / Math.max(1, data.summary.studentsWithReports)) * 100)}%
                          </Badge>
                        </span>
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

          <Card>
            <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {data.privacyNotice}
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
