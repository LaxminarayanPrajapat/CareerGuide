import { useCallback, useEffect, useState } from 'react';
import { Brain } from 'lucide-react';
import { api } from '../../lib/api';
import type { Skill } from '../../types';
import { Badge, Card, EmptyState, ErrorState, Skeleton } from '../../components/common';
import { Pagination, SearchFilters, FilterSelect } from '../../components/common/Pagination';

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[] | null>(null);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0, limit: 20 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data, meta: responseMeta } = await api.get<{ skills: Skill[] }>('/skills', {
        page,
        limit: 20,
        search: search || undefined,
        category: category || undefined,
      });
      setSkills(data.skills);
      if (responseMeta) setMeta(responseMeta as never);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [page, search, category]);

  useEffect(() => {
    const handler = window.setTimeout(() => void load(), search ? 300 : 0);
    return () => window.clearTimeout(handler);
  }, [load, search]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">Skill catalogue</h1>
        <p className="mt-1 text-sm text-slate-600">
          The structured competencies that assessments measure and career definitions require. Skills referenced by a
          question or a career cannot be deleted - deactivate them instead so historical scores stay valid.
        </p>
      </header>

      {error && <ErrorState message={error} onRetry={load} />}
      {!skills && !error && <Skeleton className="h-64 w-full" />}

      {skills && (
        <Card bodyClassName="p-0">
          <SearchFilters
            search={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            searchPlaceholder="Search skills..."
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
                { value: 'aptitude', label: 'Aptitude' },
                { value: 'technical', label: 'Technical' },
                { value: 'domain', label: 'Domain' },
                { value: 'professional', label: 'Professional' },
                { value: 'communication', label: 'Communication' },
              ]}
            />
          </SearchFilters>

          {skills.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={<Brain className="h-8 w-8" aria-hidden="true" />} title="No skills found" />
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Sample</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {skills.map((skill) => (
                    <tr key={skill._id}>
                      <td className="whitespace-nowrap font-mono text-xs text-slate-600">{skill.code}</td>
                      <td className="whitespace-nowrap font-medium text-navy-900">{skill.name}</td>
                      <td>
                        <Badge tone="neutral">{skill.category}</Badge>
                      </td>
                      <td className="max-w-md text-xs text-slate-600">{skill.description}</td>
                      <td>{skill.isSample ? <Badge tone="warning">Sample</Badge> : <Badge tone="neutral">Custom</Badge>}</td>
                      <td>
                        <Badge tone={skill.isActive ? 'success' : 'neutral'}>
                          {skill.isActive ? 'Active' : 'Inactive'}
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
            label="skills"
          />
        </Card>
      )}
    </div>
  );
}
