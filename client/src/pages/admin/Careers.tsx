import { useCallback, useEffect, useState } from 'react';
import { GraduationCap, Loader2, Plus, Save, X } from 'lucide-react';
import { api, ApiClientError } from '../../lib/api';
import type { Career, Skill } from '../../types';
import { useAuth } from '../../features/auth/AuthContext';
import { useToast } from '../../components/common/ToastProvider';
import { Badge, Card, EmptyState, ErrorState, Skeleton } from '../../components/common';
import { Pagination, SearchFilters, FilterSelect } from '../../components/common/Pagination';
import { Field, fieldErrors } from '../public/components/AuthCard';

interface RequirementDraft {
  skill: string;
  requiredLevel: number;
  weight: number;
  importance: 'core' | 'supporting';
  developmentFocus: string;
}

export default function CareersPage() {
  const { hasPermission } = useAuth();
  const toast = useToast();

  const [careers, setCareers] = useState<Career[] | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0, limit: 10 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<Career | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [draftRequirements, setDraftRequirements] = useState<RequirementDraft[]>([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data, meta: responseMeta } = await api.get<{ careers: Career[] }>('/careers', {
        page,
        limit: 10,
        search: search || undefined,
      });
      setCareers(data.careers);
      if (responseMeta) setMeta(responseMeta as never);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [page, search]);

  useEffect(() => {
    const handler = window.setTimeout(() => void load(), search ? 300 : 0);
    return () => window.clearTimeout(handler);
  }, [load, search]);

  useEffect(() => {
    api
      .get<{ skills: Skill[] }>('/skills', { limit: 200, isActive: true })
      .then(({ data }) => setSkills(data.skills))
      .catch(() => setSkills([]));
  }, []);

  function startEdit(career: Career) {
    setEditing(career);
    setFormError(null);
    setDraftRequirements(
      career.requiredSkills.map((r) => ({
        skill: r.skill,
        requiredLevel: r.requiredLevel,
        weight: r.weight,
        importance: r.importance,
        developmentFocus: r.developmentFocus,
      })),
    );
  }

  async function save() {
    if (!editing) return;
    setFormError(null);
    if (draftRequirements.length === 0) {
      setFormError('A career must define at least one required competency.');
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/careers/${editing._id}`, {
        title: editing.title,
        category: editing.category,
        description: editing.description,
        responsibilities: editing.responsibilities,
        prerequisites: editing.prerequisites,
        suggestedProjects: editing.suggestedProjects,
        isActive: editing.isActive,
        requiredSkills: draftRequirements,
      });
      toast.success('Career definition updated.');
      setEditing(null);
      await load();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">Career catalogue</h1>
        <p className="mt-1 text-sm text-slate-600">
          Editable master data. Required levels and weights feed directly into the compatibility algorithm, so changes
          affect future reports.
        </p>
      </header>

      {editing && (
        <Card
          title={`Edit: ${editing.title}`}
          actions={
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>
              <X className="h-4 w-4" aria-hidden="true" /> Close
            </button>
          }
        >
          <div className="space-y-4">
            {formError && <ErrorState message={formError} />}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="edit-title" label="Title">
                <input
                  id="edit-title"
                  className="input"
                  value={editing.title}
                  onChange={(e) => setEditing((c) => (c ? { ...c, title: e.target.value } : c))}
                />
              </Field>
              <Field id="edit-category" label="Category">
                <input
                  id="edit-category"
                  className="input"
                  value={editing.category}
                  onChange={(e) => setEditing((c) => (c ? { ...c, category: e.target.value } : c))}
                />
              </Field>
            </div>

            <Field id="edit-description" label="Description">
              <textarea
                id="edit-description"
                rows={3}
                className="input"
                value={editing.description}
                onChange={(e) => setEditing((c) => (c ? { ...c, description: e.target.value } : c))}
              />
            </Field>

            <label className="flex items-center gap-2 text-sm text-navy-800">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-accent-600 focus:ring-accent-500"
                checked={editing.isActive}
                onChange={(e) => setEditing((c) => (c ? { ...c, isActive: e.target.checked } : c))}
              />
              Active (available for matching)
            </label>

            <div>
              <p className="label">Required competencies</p>
              <div className="space-y-2">
                {draftRequirements.map((requirement, index) => (
                  <div key={requirement.skill} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="min-w-[180px] flex-1">
                        <label className="sr-only" htmlFor={`req-skill-${index}`}>
                          Skill
                        </label>
                        <select
                          id={`req-skill-${index}`}
                          className="input"
                          value={requirement.skill}
                          onChange={(e) =>
                            setDraftRequirements((list) =>
                              list.map((r, i) => (i === index ? { ...r, skill: e.target.value } : r)),
                            )
                          }
                        >
                          {skills.map((skill) => (
                            <option key={skill._id} value={skill._id}>
                              {skill.code} - {skill.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="w-28">
                        <label className="label" htmlFor={`req-level-${index}`}>
                          Required
                        </label>
                        <input
                          id={`req-level-${index}`}
                          type="number"
                          min={0}
                          max={100}
                          className="input"
                          value={requirement.requiredLevel}
                          onChange={(e) =>
                            setDraftRequirements((list) =>
                              list.map((r, i) =>
                                i === index ? { ...r, requiredLevel: Number(e.target.value) } : r,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="w-28">
                        <label className="label" htmlFor={`req-weight-${index}`}>
                          Weight
                        </label>
                        <input
                          id={`req-weight-${index}`}
                          type="number"
                          min={0.01}
                          max={1}
                          step={0.05}
                          className="input"
                          value={requirement.weight}
                          onChange={(e) =>
                            setDraftRequirements((list) =>
                              list.map((r, i) => (i === index ? { ...r, weight: Number(e.target.value) } : r)),
                            )
                          }
                        />
                      </div>
                      <div className="w-32">
                        <label className="label" htmlFor={`req-importance-${index}`}>
                          Importance
                        </label>
                        <select
                          id={`req-importance-${index}`}
                          className="input"
                          value={requirement.importance}
                          onChange={(e) =>
                            setDraftRequirements((list) =>
                              list.map((r, i) =>
                                i === index
                                  ? { ...r, importance: e.target.value as 'core' | 'supporting' }
                                  : r,
                              ),
                            )
                          }
                        >
                          <option value="core">Core</option>
                          <option value="supporting">Supporting</option>
                        </select>
                      </div>
                      {hasPermission('careers:write') && (
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() =>
                            setDraftRequirements((list) => list.filter((_, i) => i !== index))
                          }
                          aria-label={`Remove requirement ${index + 1}`}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="mt-2">
                      <label className="sr-only" htmlFor={`req-focus-${index}`}>
                        Development focus
                      </label>
                      <input
                        id={`req-focus-${index}`}
                        className="input"
                        placeholder="Development focus shown in roadmaps"
                        value={requirement.developmentFocus}
                        onChange={(e) =>
                          setDraftRequirements((list) =>
                            list.map((r, i) => (i === index ? { ...r, developmentFocus: e.target.value } : r)),
                          )
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="btn btn-sm btn-secondary mt-3"
                onClick={() =>
                  setDraftRequirements((list) => [
                    ...list,
                    {
                      skill: skills[0]?._id ?? '',
                      requiredLevel: 50,
                      weight: 1,
                      importance: 'core',
                      developmentFocus: '',
                    },
                  ])
                }
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add competency
              </button>
            </div>

            <div className="flex justify-end">
              <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" aria-hidden="true" /> Save changes
                  </>
                )}
              </button>
            </div>
          </div>
        </Card>
      )}

      {error && <ErrorState message={error} onRetry={load} />}
      {!careers && !error && <Skeleton className="h-64 w-full" />}

      {careers && (
        <Card bodyClassName="p-0">
          <SearchFilters
            search={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            searchPlaceholder="Search careers..."
          />
          {careers.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<GraduationCap className="h-8 w-8" aria-hidden="true" />}
                title="No careers found"
              />
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Competencies</th>
                    <th>Sample</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {careers.map((career) => (
                    <tr key={career._id}>
                      <td>
                        <button
                          type="button"
                          className="text-left text-sm font-medium text-navy-900 hover:underline"
                          onClick={() => setExpanded(expanded === career._id ? null : career._id)}
                        >
                          {career.title}
                        </button>
                        {expanded === career._id && (
                          <ul className="mt-2 max-w-md space-y-1">
                            {career.requiredSkills.map((r) => (
                              <li key={r.skill} className="flex items-center justify-between gap-2 text-xs">
                                <span className="truncate text-navy-700">{r.skillName}</span>
                                <span className="shrink-0 tabular-nums text-slate-500">
                                  {r.requiredLevel} &middot; w {(r.weight * 100).toFixed(0)}% &middot; {r.importance}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-slate-600">{career.category}</td>
                      <td className="tabular-nums">{career.requiredSkills.length}</td>
                      <td>{career.isSample ? <Badge tone="warning">Sample</Badge> : <Badge tone="neutral">Custom</Badge>}</td>
                      <td>
                        <Badge tone={career.isActive ? 'success' : 'neutral'}>
                          {career.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="text-right">
                        {hasPermission('careers:write') && (
                          <button type="button" className="btn btn-sm btn-secondary" onClick={() => startEdit(career)}>
                            Edit
                          </button>
                        )}
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
            label="careers"
          />
        </Card>
      )}

      <Card>
        <p className="text-xs leading-relaxed text-slate-500">
          Changes to required levels or weights affect all future compatibility scores. Historical reports keep the
          scoring version and the values that were in force when they were generated, so past results remain
          reproducible.
        </p>
      </Card>
    </div>
  );
}

export { FilterSelect };
