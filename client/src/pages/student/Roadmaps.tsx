import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Sparkles } from 'lucide-react';
import { api } from '../../lib/api';
import type { Roadmap } from '../../types';
import { Badge, Card, EmptyState, ErrorState, ProgressBar, Skeleton } from '../../components/common';
import { useToast } from '../../components/common/ToastProvider';
import { formatRelative, statusLabel } from '../../lib/format';

const STAGE_ORDER = ['beginner', 'intermediate', 'advanced'] as const;

export default function RoadmapsPage() {
  const toast = useToast();
  const [roadmaps, setRoadmaps] = useState<Roadmap[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data } = await api.get<{ roadmaps: Roadmap[] }>('/roadmaps');
      setRoadmaps(data.roadmaps);
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
      const { data } = await api.post<{ reused: boolean; reportId: string }>('/reports/generate', {
        includeRoadmaps: true,
        roadmapCount: 3,
        forceRegenerate: true,
      });
      toast.success(data.reused ? 'Roadmaps are already up to date.' : 'New roadmaps generated from your latest report.');
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
          <h1 className="text-2xl font-bold tracking-tight text-navy-900">Learning roadmaps</h1>
          <p className="mt-1 text-sm text-slate-600">
            Actionable steps for each recommended career, generated from the gap between your measured skills and that
            role&rsquo;s requirements.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={generate} disabled={generating}>
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          {generating ? 'Regenerating...' : 'Regenerate from latest report'}
        </button>
      </header>

      {error && <ErrorState message={error} onRetry={load} />}
      {!roadmaps && !error && <Skeleton className="h-64 w-full" />}

      {roadmaps && roadmaps.length === 0 && (
        <EmptyState
          icon={<BookOpen className="h-8 w-8" aria-hidden="true" />}
          title="No roadmaps yet"
          description="Roadmaps are created when a career report is generated. Complete some assessments, then generate a report to receive personalised roadmaps."
          action={
            <Link to="/reports" className="btn btn-primary">
              Go to career reports
            </Link>
          }
        />
      )}

      {roadmaps && roadmaps.length > 0 && (
        <>
          <Card>
            <p className="text-sm leading-relaxed text-slate-600">
              Every item starts as <strong>not started</strong>. Progress is only recorded when you update an item
              yourself - a roadmap is never marked complete just because it was generated.
            </p>
          </Card>

          <ul className="grid gap-4 lg:grid-cols-2">
            {roadmaps.map((roadmap) => (
              <li key={roadmap.id}>
                <Card className="flex h-full flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-base font-semibold text-navy-900">{roadmap.title}</h2>
                    <Badge tone={roadmap.progressPercent === 100 ? 'success' : 'info'}>
                      {roadmap.progressPercent}%
                    </Badge>
                  </div>

                  <div className="mt-3">
                    <ProgressBar value={roadmap.progressPercent} showValue={false} />
                  </div>

                  {roadmap.priorityGaps.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Priority gaps</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {roadmap.priorityGaps.slice(0, 4).map((gap) => (
                          <Badge
                            key={gap.skillCode}
                            tone={gap.priority === 'high' ? 'danger' : gap.priority === 'medium' ? 'warning' : 'neutral'}
                          >
                            {gap.skillName} ({Math.round(gap.gap)})
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <ul className="mt-4 flex-1 space-y-1.5 text-xs text-slate-500">
                    {STAGE_ORDER.map((stage) => {
                      const count = roadmap.items.filter((i) => i.stage === stage).length;
                      const done = roadmap.items.filter((i) => i.stage === stage && i.status === 'completed').length;
                      return (
                        <li key={stage} className="flex items-center justify-between">
                          <span className="capitalize">{stage} stage</span>
                          <span>
                            {done}/{count} complete
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                    <p className="text-xs text-slate-500">Updated {formatRelative(roadmap.lastActivityAt)}</p>
                    <Link to={`/roadmaps/${roadmap.id}`} className="btn btn-sm btn-primary">
                      Open roadmap ({roadmap.items.length} items)
                    </Link>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export { statusLabel };
