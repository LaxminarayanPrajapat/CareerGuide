import { useCallback, useEffect, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../features/auth/AuthContext';
import { useToast } from '../../components/common/ToastProvider';
import { Badge, Card, EmptyState, ErrorState, Skeleton } from '../../components/common';

interface CategoryRow {
  id: string;
  key: string;
  name: string;
  description: string;
  color: string;
  scoringModel: string;
  isActive: boolean;
  displayOrder: number;
  questionCount: number;
  attemptCount: number;
  isSample: boolean;
}

export default function CategoriesPage() {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const [categories, setCategories] = useState<CategoryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data } = await api.get<{ categories: CategoryRow[] }>('/categories');
      setCategories(data.categories);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleActive(category: CategoryRow) {
    try {
      await api.patch(`/categories/${category.id}`, { isActive: !category.isActive });
      toast.success(category.isActive ? `${category.name} deactivated.` : `${category.name} activated.`);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">Assessment categories</h1>
        <p className="mt-1 text-sm text-slate-600">
          The five assessment dimensions. Each declares whether its items are scored objectively or aggregated as
          working preferences.
        </p>
      </header>

      {error && <ErrorState message={error} onRetry={load} />}
      {!categories && !error && <Skeleton className="h-64 w-full" />}

      {categories && categories.length === 0 && (
        <EmptyState
          icon={<ClipboardList className="h-8 w-8" aria-hidden="true" />}
          title="No categories configured"
        />
      )}

      {categories && categories.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2">
          {categories.map((category) => (
            <li key={category.id}>
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-navy-900">{category.name}</h2>
                      <Badge tone={category.scoringModel === 'preference' ? 'warning' : 'info'}>
                        {category.scoringModel === 'preference' ? 'Preference' : 'Objective'}
                      </Badge>
                      {category.isSample && <Badge tone="neutral">Sample</Badge>}
                    </div>
                    <p className="mt-1 font-mono text-xs text-slate-400">{category.key}</p>
                  </div>
                  <span
                    className="h-8 w-8 shrink-0 rounded-lg border"
                    style={{ backgroundColor: `${category.color}20`, borderColor: `${category.color}60` }}
                    aria-hidden="true"
                  />
                </div>

                <p className="mt-3 text-sm leading-relaxed text-slate-600">{category.description}</p>

                <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-100 pt-3 text-center">
                  <div>
                    <dt className="text-[11px] uppercase tracking-wide text-slate-500">Questions</dt>
                    <dd className="mt-0.5 text-sm font-semibold tabular-nums text-navy-900">
                      {category.questionCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wide text-slate-500">Attempts</dt>
                    <dd className="mt-0.5 text-sm font-semibold tabular-nums text-navy-900">
                      {category.attemptCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wide text-slate-500">Order</dt>
                    <dd className="mt-0.5 text-sm font-semibold tabular-nums text-navy-900">
                      {category.displayOrder}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <Badge tone={category.isActive ? 'success' : 'neutral'}>
                    {category.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  {hasPermission('categories:write') && (
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => void toggleActive(category)}
                    >
                      {category.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Card>
        <p className="text-xs leading-relaxed text-slate-500">
          Deactivating a category hides it from candidate-facing navigation. Recorded attempts keep their original
          category so historical results are never reclassified.
        </p>
      </Card>
    </div>
  );
}
