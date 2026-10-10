import { useCallback, useEffect, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { api } from '../../lib/api';
import type { Career } from '../../types';
import { Badge, Card, EmptyState, ErrorState, Skeleton } from '../../components/common';
import { Pagination, SearchFilters, FilterSelect } from '../../components/common/Pagination';

/**
 * Read-only view of the career catalogue (editable master data, never
 * hardcoded in the frontend).
 */
export default function CareersCatalogue() {
  const [careers, setCareers] = useState<Career[] | null>(null);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0, limit: 12 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data, meta: responseMeta } = await api.get<{ careers: Career[] }>('/careers', {
        page,
        limit: 12,
        search: search || undefined,
        category: category || undefined,
      });
      setCareers(data.careers);
      if (responseMeta) setMeta(responseMeta as never);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [page, search, category]);

  useEffect(() => {
    const handler = window.setTimeout(() => void load(), search ? 300 : 0);
    return () => window.clearTimeout(handler);
  }, [load, search]);

  const categories = Array.from(new Set((careers ?? []).map((c) => c.category)));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">Career catalogue</h1>
        <p className="mt-1 text-sm text-slate-600">
          Editable master data held in the database. Each entry lists the competencies a role requires and at what level.
        </p>
      </header>

      {error && <ErrorState message={error} onRetry={load} />}
      {!careers && !error && <Skeleton className="h-96 w-full" />}

      {careers && (
        <>
          <Card bodyClassName="p-0">
            <SearchFilters
              search={search}
              onSearchChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              searchPlaceholder="Search careers by title or description..."
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
                  ...categories.map((c) => ({ value: c, label: c })),
                ]}
              />
            </SearchFilters>
          </Card>

          {careers.length === 0 ? (
            <EmptyState
              icon={<GraduationCap className="h-8 w-8" aria-hidden="true" />}
              title="No careers match your filters"
              description="Try a different search term or clear the category filter."
            />
          ) : (
            <ul className="space-y-4">
              {careers.map((career) => {
                const isOpen = expanded === career._id;
                return (
                  <li key={career._id}>
                    <Card>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-base font-semibold text-navy-900">{career.title}</h2>
                            <Badge tone="neutral">{career.category}</Badge>
                            {career.isSample && <Badge tone="warning">Sample data</Badge>}
                            {!career.isActive && <Badge tone="danger">Inactive</Badge>}
                          </div>
                          <p className="mt-2 text-sm leading-relaxed text-slate-600">{career.description}</p>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary shrink-0"
                          onClick={() => setExpanded(isOpen ? null : career._id)}
                          aria-expanded={isOpen}
                        >
                          {isOpen ? 'Hide requirements' : `Requirements (${career.requiredSkills.length})`}
                        </button>
                      </div>

                      {isOpen && (
                        <div className="mt-5 space-y-5 border-t border-slate-200 pt-5">
                          <div className="table-wrap">
                            <table className="data-table">
                              <thead>
                                <tr>
                                  <th>Competency</th>
                                  <th>Required level</th>
                                  <th>Importance</th>
                                  <th>Weight</th>
                                </tr>
                              </thead>
                              <tbody>
                                {career.requiredSkills.map((requirement) => (
                                  <tr key={requirement.skill}>
                                    <td>
                                      <span className="font-medium text-navy-900">{requirement.skillName}</span>
                                      {requirement.developmentFocus && (
                                        <span className="mt-0.5 block text-xs text-slate-500">
                                          {requirement.developmentFocus}
                                        </span>
                                      )}
                                    </td>
                                    <td className="tabular-nums">{requirement.requiredLevel}</td>
                                    <td>
                                      <Badge tone={requirement.importance === 'core' ? 'info' : 'neutral'}>
                                        {requirement.importance}
                                      </Badge>
                                    </td>
                                    <td className="tabular-nums text-slate-600">
                                      {(requirement.weight * 100).toFixed(0)}%
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {career.responsibilities.length > 0 && (
                            <div>
                              <h3 className="text-sm font-semibold text-navy-900">Typical responsibilities</h3>
                              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                                {career.responsibilities.map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {career.learningStages.length > 0 && (
                            <div>
                              <h3 className="text-sm font-semibold text-navy-900">Suggested learning stages</h3>
                              <ol className="mt-2 space-y-2">
                                {career.learningStages.map((stage) => (
                                  <li key={stage.stage} className="text-sm">
                                    <span className="font-medium capitalize text-navy-800">{stage.stage}:</span>{' '}
                                    <span className="text-slate-600">{stage.focus.join(', ')}</span>
                                  </li>
                                ))}
                              </ol>
                            </div>
                          )}

                          {career.prerequisites.length > 0 && (
                            <div>
                              <h3 className="text-sm font-semibold text-navy-900">Prerequisites</h3>
                              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                                {career.prerequisites.map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500">
                            {career.sourceNote}
                          </p>
                        </div>
                      )}
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}

          <Card bodyClassName="p-0">
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              total={meta.total}
              limit={meta.limit}
              onPageChange={setPage}
              label="careers"
            />
          </Card>
        </>
      )}
    </div>
  );
}
