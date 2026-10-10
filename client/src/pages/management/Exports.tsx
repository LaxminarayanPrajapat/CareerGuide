import { useCallback, useEffect, useState } from 'react';
import { Download, FileSpreadsheet, Info, ShieldCheck } from 'lucide-react';
import { api, downloadFile } from '../../lib/api';
import type { InstitutionAnalytics } from '../../types';
import { Badge, Card, ErrorState, Skeleton, StatCard } from '../../components/common';
import { useToast } from '../../components/common/ToastProvider';
import { categoryLabel } from '../../lib/format';

export default function ManagementExports() {
  const toast = useToast();
  const [data, setData] = useState<InstitutionAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data: response } = await api.get<InstitutionAnalytics>('/analytics/institution');
      setData(response);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function exportCsv() {
    setExporting(true);
    try {
      await downloadFile('/exports/analytics.csv', 'institutional-analytics.csv');
      toast.success('Aggregate CSV downloaded.');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">Aggregate exports</h1>
        <p className="mt-1 text-sm text-slate-600">
          Download the same aggregate figures shown on screen. The export endpoint applies the same authorisation as
          the dashboard, so exported data can never exceed what you are able to view.
        </p>
      </header>

      {error && <ErrorState message={error} onRetry={load} />}
      {!data && !error && <Skeleton className="h-64 w-full" />}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Students" value={data.summary.totalStudents} />
            <StatCard label="Assessments completed" value={data.summary.totalCompletedAssessments} />
            <StatCard label="Students with reports" value={data.summary.studentsWithReports} />
          </div>

          <Card title="Institution summary" description="Exactly the metrics included in the CSV export">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Registered students</td>
                    <td className="tabular-nums font-medium">{data.summary.totalStudents}</td>
                  </tr>
                  <tr>
                    <td>Students with any completed assessment</td>
                    <td className="tabular-nums font-medium">{data.summary.studentsWithProgress}</td>
                  </tr>
                  <tr>
                    <td>Students with a career report</td>
                    <td className="tabular-nums font-medium">{data.summary.studentsWithReports}</td>
                  </tr>
                  <tr>
                    <td>Total completed assessments</td>
                    <td className="tabular-nums font-medium">{data.summary.totalCompletedAssessments}</td>
                  </tr>
                  <tr>
                    <td>Published test sets</td>
                    <td className="tabular-nums font-medium">{data.summary.publishedAssessments}</td>
                  </tr>
                  <tr>
                    <td>Overall completion rate</td>
                    <td className="tabular-nums font-medium">
                      {data.summary.overallCompletionRate === null
                        ? 'Not available'
                        : `${data.summary.overallCompletionRate}%`}
                    </td>
                  </tr>
                  <tr>
                    <td>Average objective score</td>
                    <td className="tabular-nums font-medium">
                      {data.summary.overallAverageScore === null
                        ? 'Not available'
                        : `${data.summary.overallAverageScore}%`}
                    </td>
                  </tr>
                  <tr>
                    <td>Active career definitions</td>
                    <td className="tabular-nums font-medium">{data.summary.activeCareers}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {data.categoryPerformance.length > 0 && (
              <div className="mt-5">
                <h3 className="text-sm font-semibold text-navy-900">By assessment category</h3>
                <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
                  {data.categoryPerformance.map((item) => (
                    <li key={item.category} className="flex items-center justify-between gap-3">
                      <Badge tone="info">{categoryLabel(item.category)}</Badge>
                      <span className="tabular-nums">
                        {item.completed} completed &middot; {item.averagePercentage}% average
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary" onClick={exportCsv} disabled={exporting}>
                {exporting ? (
                  <>
                    <Download className="h-4 w-4 animate-pulse" aria-hidden="true" /> Preparing file...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="h-4 w-4" aria-hidden="true" /> Download CSV
                  </>
                )}
              </button>
            </div>
          </Card>

          <Card title="What is and is not included">
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                Included: counts, averages, completion rates and career-interest distributions.
              </li>
              <li className="flex gap-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" aria-hidden="true" />
                Excluded: names, emails, individual scores, answers, reports and skill profiles.
              </li>
              <li className="flex gap-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" aria-hidden="true" />
                The management role has no write access anywhere in the system. Exports are generated from the same
                aggregated queries used on screen.
              </li>
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
