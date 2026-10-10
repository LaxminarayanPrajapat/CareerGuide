import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ClipboardList,
  Database,
  FileText,
  Gauge,
  ScrollText,
  Users,
} from 'lucide-react';
import { api } from '../../lib/api';
import type { SystemAnalytics } from '../../types';
import { useAuth } from '../../features/auth/AuthContext';
import { Badge, Card, ErrorState, ProgressBar, Skeleton, StatCard } from '../../components/common';
import { roleLabel } from '../../lib/format';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<SystemAnalytics | null>(null);
  const [audit, setAudit] = useState<Array<{ id: string; action: string; message: string; severity: string; createdAt: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [analytics, logs] = await Promise.all([
        api.get<SystemAnalytics>('/analytics/system'),
        api.get<{ logs: typeof audit }>('/audit-logs', { limit: 8 }),
      ]);
      setData(analytics.data);
      setAudit(logs.data.logs);
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
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">
          Administrator dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-600">Signed in as {user?.email} &middot; full platform access</p>
      </header>

      {data.summary.recentSecurityEvents > 0 && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            {data.summary.recentSecurityEvents} warning or critical audit event(s) recorded in the last 7 days.{' '}
            <Link to="/admin/audit" className="font-medium underline">
              Review the audit log
            </Link>
            .
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total users"
          value={data.summary.totalUsers}
          hint={`${data.summary.activeUsers} active`}
          icon={<Users className="h-4 w-4" aria-hidden="true" />}
        />
        <StatCard
          label="Question bank"
          value={data.summary.totalQuestions}
          hint={`${data.summary.activeQuestions} active`}
          icon={<Database className="h-4 w-4" aria-hidden="true" />}
          tone="accent"
        />
        <StatCard
          label="Published test sets"
          value={data.summary.publishedAssessments}
          hint={`${data.summary.totalAssessments} total`}
          icon={<ClipboardList className="h-4 w-4" aria-hidden="true" />}
        />
        <StatCard
          label="Career definitions"
          value={data.summary.activeCareers}
          hint={`${data.summary.totalSkills} active skills`}
          icon={<Gauge className="h-4 w-4" aria-hidden="true" />}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total attempts" value={data.summary.totalAttempts} />
        <StatCard
          label="Completed attempts"
          value={data.summary.completedAttempts}
          hint={`${data.completionRate === null ? 'n/a' : `${data.completionRate}%`} of all attempts`}
          tone="accent"
        />
        <StatCard
          label="Live attempts"
          value={data.summary.liveAttempts}
          hint="Currently in progress"
          tone={data.summary.liveAttempts > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="Career reports"
          value={data.summary.totalReports}
          icon={<FileText className="h-4 w-4" aria-hidden="true" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Users by role">
          <ul className="space-y-3">
            {data.usersByRole.map((entry) => (
              <li key={entry.role}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-navy-800">{roleLabel(entry.role)}</span>
                  <span className="font-medium tabular-nums text-navy-900">{entry.count}</span>
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

        <Card
          title="Recent activity"
          actions={
            <Link to="/admin/audit" className="btn btn-sm btn-secondary">
              Full audit log
            </Link>
          }
        >
          {audit.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No activity recorded yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {audit.map((entry) => (
                <li key={entry.id} className="py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 flex-1 text-sm text-navy-800">{entry.message}</p>
                    <Badge
                      tone={
                        entry.severity === 'critical'
                          ? 'danger'
                          : entry.severity === 'warning'
                            ? 'warning'
                            : 'neutral'
                      }
                    >
                      {entry.severity}
                    </Badge>
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] text-slate-400">{entry.action}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Administration shortcuts">
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/users" className="btn btn-secondary">
            <Users className="h-4 w-4" aria-hidden="true" /> User management
          </Link>
          <Link to="/admin/questions" className="btn btn-secondary">
            <Database className="h-4 w-4" aria-hidden="true" /> Question bank
          </Link>
          <Link to="/admin/assessments" className="btn btn-secondary">
            <ClipboardList className="h-4 w-4" aria-hidden="true" /> Test sets
          </Link>
          <Link to="/admin/careers" className="btn btn-secondary">
            <Gauge className="h-4 w-4" aria-hidden="true" /> Career catalogue
          </Link>
          <Link to="/admin/skills" className="btn btn-secondary">
            <Database className="h-4 w-4" aria-hidden="true" /> Skill catalogue
          </Link>
          <Link to="/admin/categories" className="btn btn-secondary">
            <ClipboardList className="h-4 w-4" aria-hidden="true" /> Categories
          </Link>
          <Link to="/admin/settings" className="btn btn-secondary">
            <Activity className="h-4 w-4" aria-hidden="true" /> System settings
          </Link>
          <Link to="/admin/audit" className="btn btn-secondary">
            <ScrollText className="h-4 w-4" aria-hidden="true" /> Audit logs
          </Link>
        </div>
      </Card>
    </div>
  );
}
