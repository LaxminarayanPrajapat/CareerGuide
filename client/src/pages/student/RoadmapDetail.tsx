import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Circle, CircleDot, ExternalLink, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../../lib/api';
import type { Roadmap } from '../../types';
import { Badge, Card, ErrorState, LoadingBlock, ProgressBar } from '../../components/common';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useToast } from '../../components/common/ToastProvider';
import { statusLabel } from '../../lib/format';

const STAGE_TITLES: Record<string, string> = {
  beginner: 'Beginner stage',
  intermediate: 'Intermediate stage',
  advanced: 'Advanced stage',
};

const KIND_LABELS: Record<string, string> = {
  learn: 'Learn',
  practice: 'Practice',
  project: 'Portfolio project',
  milestone: 'Milestone',
  assess: 'Re-assess',
};

export default function RoadmapDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ itemId: string; status: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<{ roadmap: Roadmap }>(`/roadmaps/${id}`);
      setRoadmap(data.roadmap);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirmUpdate() {
    if (!pending || !id) return;
    setSaving(true);
    try {
      const { data } = await api.patch<{ roadmap: Roadmap }>(`/roadmaps/${id}/items/${pending.itemId}`, {
        status: pending.status,
      });
      setRoadmap(data.roadmap);
      toast.success(`Item marked as ${pending.status.replace(/_/g, ' ')}.`);
      setPending(null);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingBlock label="Loading roadmap" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!roadmap) return null;

  const stages = ['beginner', 'intermediate', 'advanced'] as const;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link to="/roadmaps" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-navy-900">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to roadmaps
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-navy-900">{roadmap.title}</h1>
        <p className="mt-1 text-sm text-slate-600">
          Generated from {roadmap.sourceReportTitle} &middot; scoring version {roadmap.scoringVersion}
        </p>
      </div>

      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-navy-900">Your progress</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {roadmap.items.filter((i) => i.status === 'completed').length} of {roadmap.items.length} items completed
            </p>
          </div>
          <span className="text-2xl font-bold tabular-nums text-navy-900">{roadmap.progressPercent}%</span>
        </div>
        <div className="mt-3">
          <ProgressBar value={roadmap.progressPercent} showValue={false} />
        </div>
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
          {roadmap.summary}
        </p>
      </Card>

      {stages.map((stage) => {
        const items = roadmap.items.filter((i) => i.stage === stage);
        if (items.length === 0) return null;
        const milestone = roadmap.milestones.find((m) => m.stage === stage);

        return (
          <Card
            key={stage}
            title={STAGE_TITLES[stage] ?? stage}
            description={milestone?.completionCriteria}
            actions={
              <Badge tone={milestone?.completed ? 'success' : 'neutral'}>
                {milestone?.completed ? 'Stage complete' : `${items.filter((i) => i.status === 'completed').length}/${items.length}`}
              </Badge>
            }
          >
            <ul className="space-y-3">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={clsx(
                    'rounded-lg border p-4 transition-colors',
                    item.status === 'completed'
                      ? 'border-emerald-200 bg-emerald-50/50'
                      : item.status === 'in_progress'
                        ? 'border-accent-300 bg-accent-50/50'
                        : 'border-slate-200 bg-white',
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="neutral">{KIND_LABELS[item.kind] ?? statusLabel(item.kind)}</Badge>
                        {item.skillCode && <Badge tone="info">{item.skillCode.replace(/_/g, ' ')}</Badge>}
                        <span className="text-xs text-slate-500">~{item.estimatedHours}h</span>
                      </div>
                      <h3
                        className={clsx(
                          'mt-2 text-sm font-semibold',
                          item.status === 'completed' ? 'text-slate-500 line-through' : 'text-navy-900',
                        )}
                      >
                        {item.title}
                      </h3>
                      {item.description && (
                        <p className="mt-1 text-sm leading-relaxed text-slate-600">{item.description}</p>
                      )}
                      {item.completionCriteria && (
                        <p className="mt-2 rounded-lg bg-white px-3 py-2 text-xs text-slate-600">
                          <strong>Done when:</strong> {item.completionCriteria}
                        </p>
                      )}
                      {item.resourceLinks.length > 0 && (
                        <ul className="mt-2 flex flex-wrap gap-3">
                          {item.resourceLinks.map((link) => (
                            <li key={link.url}>
                              <a
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-medium text-accent-700 hover:underline"
                              >
                                {link.title}
                                <ExternalLink className="h-3 w-3" aria-hidden="true" />
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      {item.status === 'completed' ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-label="Completed" />
                      ) : item.status === 'in_progress' ? (
                        <CircleDot className="h-5 w-5 text-accent-600" aria-label="In progress" />
                      ) : (
                        <Circle className="h-5 w-5 text-slate-300" aria-label="Not started" />
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                    {item.status !== 'completed' && (
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => setPending({ itemId: item.id, status: 'completed' })}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Mark complete
                      </button>
                    )}
                    {item.status !== 'in_progress' && item.status !== 'completed' && (
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={() => setPending({ itemId: item.id, status: 'in_progress' })}
                      >
                        <Loader2 className="h-3.5 w-3.5" aria-hidden="true" /> Start
                      </button>
                    )}
                    {item.status !== 'not_started' && (
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={() => setPending({ itemId: item.id, status: 'not_started' })}
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        );
      })}

      <ConfirmDialog
        open={pending !== null}
        title={pending?.status === 'completed' ? 'Mark this item complete?' : 'Start this item?'}
        message={
          pending?.status === 'completed'
            ? 'Your progress percentage will be updated. You can reset the item later if you have not actually finished the work.'
            : 'This records that you have started working on this item.'
        }
        confirmLabel={pending?.status === 'completed' ? 'Yes, mark complete' : 'Start item'}
        busy={saving}
        onConfirm={confirmUpdate}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
