import { useCallback, useEffect, useState } from 'react';
import { BarChart3, Download, Info } from 'lucide-react';
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
import type { CounsellorAnalytics } from '../../types';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
  StatCard,
} from '../../components/common';
import { FilterSelect } from '../../components/common/Pagination';
import { useToast } from '../../components/common/ToastProvider';
import { categoryLabel } from '../../lib/format';

const COLOURS = ['#2563eb', '#0d9488', '#7c3aed', '#ea580c', '#e11d48'];

export default function BatchAnalyticsPage() {
  const toast = useToast();
  const [data, setData] = useState<CounsellorAnalytics | null>(null);
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
      const { data: response } = await api.get<CounsellorAnalytics>('/analytics/counsellor', {
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
      await downloadFile('/exports/analytics.csv', 'counsellor-analytics.csv');
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
          <h1 className="text-2xl font-bold tracking-tight text-navy-900">Batch performance analytics</h1>
          <p className="mt-1 text-sm text-slate-600">
            Aggregate results for the candidates assigned to you. Individual candidate answers are never shown here.
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

      {data && (
        <>
          {data.isEmpty ? (
            <EmptyState
              icon={<BarChart3 className="h-8 w-8" aria-hidden="true" />}
              title="No candidates in this selection"
              description="Adjust the filters or ask an administrator to assign candidates to you."
            />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Students" value={data.summary.assignedStudents} />
                <StatCard label="With progress" value={data.summary.studentsWithProgress} tone="accent" />
                <StatCard
                  label="Not started"
                  value={data.summary.studentsWithoutAnyAssessment}
                  tone={data.summary.studentsWithoutAnyAssessment > 0 ? 'warning' : 'default'}
                />
                <StatCard
                  label="Average score"
                  value={data.summary.overallAverageScore === null ? 'n/a' : `${data.summary.overallAverageScore}%`}
                />
              </div>

              <Card title="Average score by category">
                {data.categoryPerformance.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">No objective assessments completed yet.</p>
                ) : (
                  <div className="h-72 w-full">
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
                          formatter={(value: number, name) => [
                            value,
                            name === 'averagePercentage' ? 'Average score' : 'Completed',
                          ]}
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

              <div className="grid gap-6 lg:grid-cols-2">
                <Card title="Career interest distribution" description="Top match in each candidate's report">
                  {data.mostCommonTopCareer.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-500">No reports generated yet.</p>
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

                <Card title="Students needing attention">
                  {data.studentsNeedingAttention.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-500">
                      All assigned students have completed at least two assessments.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {data.studentsNeedingAttention.map((entry) => (
                        <li
                          key={entry.candidateId}
                          className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-2.5"
                        >
                          <span className="truncate font-mono text-xs text-slate-600">
                            {entry.candidateId.slice(-8)}
                          </span>
                          <Badge tone="warning">{entry.completedAssessments} completed</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>

              <Card>
                <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  These figures describe only the assessments completed in this system. They are not a measure of
                  ability, and no cohort ranking or percentile is produced. Sample sizes are shown so that small groups
                  are not over-interpreted.
                </p>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
