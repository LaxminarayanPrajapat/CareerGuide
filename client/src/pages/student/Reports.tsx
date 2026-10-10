import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Info, Loader2, Sparkles } from 'lucide-react';
import { api } from '../../lib/api';
import type { CareerReport } from '../../types';
import { Badge, Card, EmptyState, ErrorState, Skeleton, confidenceBadge } from '../../components/common';
import { formatDateTime } from '../../lib/format';
import { useToast } from '../../components/common/ToastProvider';

export default function ReportsPage() {
  const toast = useToast();
  const [reports, setReports] = useState<CareerReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data } = await api.get<{ reports: CareerReport[] }>('/reports', { limit: 20 });
      setReports(data.reports);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function generate() {
    setGenerating(true);
    try {
      const { data } = await api.post<{
        reportId: string;
        reused: boolean;
        ai: { available: boolean; providerUsed: string; failureReason: string | null };
      }>('/reports/generate', { includeRoadmaps: true, roadmapCount: 3 });

      if (data.reused) {
        toast.info('Your existing report already reflects your current skill profile.');
      } else {
        toast.success(`Report ${data.reportId} generated.`);
      }
      if (!data.ai.available && data.ai.failureReason) {
        toast.notify(
          `AI narrative unavailable (${data.ai.failureReason}). A deterministic report was produced instead.`,
          'info',
        );
      }
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900">Career reports</h1>
          <p className="mt-1 text-sm text-slate-600">
            Each report records the scoring version, the assessments used and the skill profile revision it was
            computed from.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={generate} disabled={generating}>
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" aria-hidden="true" /> Generate report
            </>
          )}
        </button>
      </header>

      {error && <ErrorState message={error} onRetry={load} />}
      {!reports && !error && <Skeleton className="h-64 w-full" />}

      {reports && reports.length === 0 && (
        <EmptyState
          icon={<FileText className="h-8 w-8" aria-hidden="true" />}
          title="No reports generated yet"
          description="A report is computed from your completed assessments. Complete a few tests first, then generate your report to receive ranked career options with evidence and a development roadmap."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link to="/assessments" className="btn btn-secondary">
                Take an assessment
              </Link>
              <button type="button" className="btn btn-primary" onClick={generate} disabled={generating}>
                Generate report now
              </button>
            </div>
          }
        />
      )}

      {reports && reports.length > 0 && (
        <>
          <Card>
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" aria-hidden="true" />
              <p className="text-sm leading-relaxed text-slate-600">
                Compatibility scores compare your measured competencies with each career definition. They are not a
                probability of getting a job or a prediction of success in a profession, and they never exclude a
                career simply because you have not yet learned a required skill.
              </p>
            </div>
          </Card>

          <ul className="grid gap-4 lg:grid-cols-2">
            {reports.map((report) => {
              const top = report.recommendations[0];
              return (
                <li key={report.id}>
                  <Card className="flex h-full flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-base font-semibold text-navy-900">{report.reportNumber}</h2>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Generated {formatDateTime(report.generatedAt)}
                        </p>
                      </div>
                      <Badge tone={report.aiProviderUsed === 'none' ? 'neutral' : 'success'}>
                        {report.aiProviderUsed === 'none' ? 'Deterministic' : `AI: ${report.aiProviderUsed}`}
                      </Badge>
                    </div>

                    <dl className="mt-4 grid grid-cols-3 gap-3 border-y border-slate-100 py-3 text-center">
                      <div>
                        <dt className="text-[11px] uppercase tracking-wide text-slate-500">Assessments</dt>
                        <dd className="mt-0.5 text-sm font-semibold text-navy-900">
                          {report.completedAssessments}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] uppercase tracking-wide text-slate-500">Coverage</dt>
                        <dd className="mt-0.5 text-sm font-semibold text-navy-900">
                          {Math.round(report.dataCoverage * 100)}%
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] uppercase tracking-wide text-slate-500">Options</dt>
                        <dd className="mt-0.5 text-sm font-semibold text-navy-900">
                          {report.recommendations.length}
                        </dd>
                      </div>
                    </dl>

                    {top && (
                      <div className="mt-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Top match</p>
                        <div className="mt-1 flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-medium text-navy-900">{top.careerTitle}</span>
                          <span className="flex shrink-0 items-center gap-2">
                            <span className="text-lg font-semibold text-navy-900">{top.compatibilityScore}</span>
                            <Badge tone="neutral" className={confidenceBadge(top.confidence)}>
                              {top.confidence}
                            </Badge>
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2 pt-1">
                      <Link to={`/reports/${report.reportNumber}`} className="btn btn-sm btn-primary">
                        Open report
                      </Link>
                      <a
                        href={`/api/v1/reports/${report.reportNumber}/download`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-secondary"
                      >
                        Print / save as PDF
                      </a>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
