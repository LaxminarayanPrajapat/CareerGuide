import type { ReactNode } from 'react';
import clsx from 'clsx';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { confidenceBadge, scoreBarColour, scoreColour } from '../../lib/format';

// Re-exported so feature modules have a single import for shared UI helpers.
export { confidenceBadge, scoreBarColour, scoreColour };

export function Card({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={clsx('card', className)}>
      {(title || actions) && (
        <header className="card-header">
          <div className="min-w-0">
            {title && <h2 className="card-title">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={clsx('px-5 py-4', bodyClassName)}>{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'default',
  loading,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: 'default' | 'accent' | 'warning';
  loading?: boolean;
}) {
  return (
    <div
      className={clsx(
        'card px-5 py-4',
        tone === 'accent' && 'border-accent-200 bg-accent-50/50',
        tone === 'warning' && 'border-amber-200 bg-amber-50/50',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          {loading ? (
            <div className="mt-2 h-7 w-20 animate-pulse rounded bg-slate-200" aria-hidden="true" />
          ) : (
            <p className="mt-1 truncate text-2xl font-semibold text-navy-900">{value}</p>
          )}
          {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </div>
        {icon && <div className="shrink-0 rounded-lg bg-navy-50 p-2 text-navy-700">{icon}</div>}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-6 py-12 text-center">
      {icon && <div className="mb-3 text-slate-400">{icon}</div>}
      <p className="text-sm font-semibold text-navy-800">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between"
    >
      <span className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{message}</span>
      </span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn btn-sm btn-secondary shrink-0">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Try again
        </button>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded bg-slate-200', className)} aria-hidden="true" />;
}

export function LoadingBlock({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}) {
  const tones = {
    neutral: 'badge-neutral',
    success: 'badge-success',
    warning: 'badge-warning',
    danger: 'badge-danger',
    info: 'badge-info',
  } as const;
  return <span className={clsx(tones[tone], className)}>{children}</span>;
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showValue = true,
  colourClass = 'bg-accent-500',
}: {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  colourClass?: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div>
      {label && (
        <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
          <span className="truncate">{label}</span>
          {showValue && <span className="ml-2 shrink-0 font-medium tabular-nums">{Math.round(pct)}%</span>}
        </div>
      )}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Progress'}
      >
        <div className={clsx('h-full rounded-full transition-all', colourClass)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function ScoreBadge({ score, label }: { score: number; label?: string }) {
  const tone =
    score >= 75 ? 'success' : score >= 50 ? 'info' : score >= 30 ? 'warning' : 'danger';
  return (
    <Badge tone={tone}>
      {label ? `${label}: ` : ''}
      {score}
    </Badge>
  );
}
