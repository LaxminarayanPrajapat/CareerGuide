import { useCallback, useEffect, useState } from 'react';
import { Download, ScrollText, ShieldAlert } from 'lucide-react';
import { api, downloadFile } from '../../lib/api';
import type { AuditLogEntry } from '../../types';
import { useToast } from '../../components/common/ToastProvider';
import { Badge, Card, EmptyState, ErrorState, Skeleton } from '../../components/common';
import { Pagination, SearchFilters, FilterSelect } from '../../components/common/Pagination';
import { formatDateTime, statusLabel } from '../../lib/format';

export default function AuditPage() {
  const toast = useToast();
  const [logs, setLogs] = useState<AuditLogEntry[] | null>(null);
  const [summary, setSummary] = useState<Array<{ category: string; severity: string; count: number }>>([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0, limit: 25 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('');
  const [outcome, setOutcome] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data, meta: responseMeta } = await api.get<{
        logs: AuditLogEntry[];
        summary: Array<{ category: string; severity: string; count: number }>;
      }>('/audit-logs', {
        page,
        limit: 25,
        search: search || undefined,
        category: category || undefined,
        severity: severity || undefined,
        outcome: outcome || undefined,
      });
      setLogs(data.logs);
      setSummary(data.summary);
      if (responseMeta) setMeta(responseMeta as never);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [page, search, category, severity, outcome]);

  useEffect(() => {
    const handler = window.setTimeout(() => void load(), search ? 300 : 0);
    return () => window.clearTimeout(handler);
  }, [load, search]);

  async function exportCsv() {
    setExporting(true);
    try {
      await downloadFile('/exports/analytics.csv', 'system-analytics.csv');
      toast.success('System analytics exported.');
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
          <h1 className="text-2xl font-bold tracking-tight text-navy-900">Audit log</h1>
          <p className="mt-1 text-sm text-slate-600">
            Security-relevant and administrative events. Passwords, tokens and raw answer payloads are never recorded -
            only safe metadata.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={exportCsv} disabled={exporting}>
          <Download className="h-4 w-4" aria-hidden="true" />
          {exporting ? 'Preparing...' : 'Export system metrics'}
        </button>
      </header>

      {summary.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {summary.map((entry) => (
            <Badge
              key={`${entry.category}-${entry.severity}`}
              tone={entry.severity === 'critical' ? 'danger' : entry.severity === 'warning' ? 'warning' : 'neutral'}
            >
              {entry.category} / {entry.severity}: {entry.count}
            </Badge>
          ))}
        </div>
      )}

      {error && <ErrorState message={error} onRetry={load} />}
      {!logs && !error && <Skeleton className="h-96 w-full" />}

      {logs && (
        <Card bodyClassName="p-0">
          <SearchFilters
            search={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            searchPlaceholder="Search action, message or actor email..."
          >
            <FilterSelect
              label="Category"
              value={category}
              onChange={(value) => {
                setCategory(value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All categories' },
                { value: 'auth', label: 'Authentication' },
                { value: 'access', label: 'Access' },
                { value: 'admin', label: 'Administration' },
                { value: 'assessment', label: 'Assessment' },
                { value: 'report', label: 'Reports' },
                { value: 'system', label: 'System' },
                { value: 'security', label: 'Security' },
              ]}
            />
            <FilterSelect
              label="Severity"
              value={severity}
              onChange={(value) => {
                setSeverity(value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All severities' },
                { value: 'info', label: 'Info' },
                { value: 'warning', label: 'Warning' },
                { value: 'critical', label: 'Critical' },
              ]}
            />
            <FilterSelect
              label="Outcome"
              value={outcome}
              onChange={(value) => {
                setOutcome(value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All outcomes' },
                { value: 'success', label: 'Success' },
                { value: 'failure', label: 'Failure' },
                { value: 'denied', label: 'Denied' },
              ]}
            />
          </SearchFilters>

          {logs.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<ScrollText className="h-8 w-8" aria-hidden="true" />}
                title="No audit entries match"
                description="Adjust the filters to see more activity."
              />
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Category</th>
                    <th>Message</th>
                    <th>Outcome</th>
                    <th>Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="whitespace-nowrap text-xs text-slate-600">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="whitespace-nowrap text-xs">
                        <span className="block text-navy-800">{log.actorEmail ?? 'System'}</span>
                        {log.actorRole && <span className="text-slate-400">{log.actorRole}</span>}
                      </td>
                      <td className="whitespace-nowrap font-mono text-[11px] text-slate-600">{log.action}</td>
                      <td>
                        <Badge tone="neutral">{log.category}</Badge>
                      </td>
                      <td className="max-w-md text-xs text-slate-700">{log.message}</td>
                      <td>
                        <Badge
                          tone={
                            log.outcome === 'success'
                              ? 'success'
                              : log.outcome === 'failure'
                                ? 'warning'
                                : 'danger'
                          }
                        >
                          {statusLabel(log.outcome)}
                        </Badge>
                      </td>
                      <td>
                        <Badge
                          tone={
                            log.severity === 'critical'
                              ? 'danger'
                              : log.severity === 'warning'
                                ? 'warning'
                                : 'neutral'
                          }
                        >
                          {log.severity === 'critical' && <ShieldAlert className="h-3 w-3" aria-hidden="true" />}
                          {log.severity}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            limit={meta.limit}
            onPageChange={setPage}
            label="audit entries"
          />
        </Card>
      )}
    </div>
  );
}
